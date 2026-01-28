// JSONL parsing for Codex CLI session files (~/.codex/sessions/**.jsonl)

import type { ContentBlock, Message } from './parser';

export interface CodexSessionMeta {
  id?: string;
  cwd?: string;
  startedAt?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeJsonParse(line: string): unknown | null {
  try {
    return JSON.parse(line) as unknown;
  } catch {
    return null;
  }
}

function toIso(ts: unknown): string | undefined {
  if (typeof ts !== 'string') return undefined;
  // Codex sessions store ISO timestamps; accept as-is.
  if (!ts.trim()) return undefined;
  return ts;
}

function parseArguments(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return { raw };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { value: parsed };
  } catch {
    return { raw };
  }
}

function mapFunctionCallToToolUse(
  name: string,
  callId: string,
  args: Record<string, unknown>,
): ContentBlock {
  if (name === 'exec_command') {
    return {
      type: 'tool_use',
      id: callId,
      name: 'Bash',
      input: { ...args, command: args.cmd },
    };
  }

  if (name === 'apply_patch') {
    const patch =
      typeof args.patch === 'string' ? args.patch : typeof args.raw === 'string' ? args.raw : '';
    return {
      type: 'tool_use',
      id: callId,
      name: 'Write',
      input: { content: patch },
    };
  }

  if (name === 'request_user_input') {
    return {
      type: 'tool_use',
      id: callId,
      name: 'AskUserQuestion',
      input: args,
    };
  }

  return {
    type: 'tool_use',
    id: callId,
    name,
    input: args,
  };
}

export function extractCodexSessionMeta(content: string): CodexSessionMeta {
  const lines = content.split('\n').filter(Boolean);

  for (const line of lines) {
    const obj = safeJsonParse(line);
    if (!isRecord(obj)) continue;

    const type = typeof obj.type === 'string' ? obj.type : undefined;
    if (type !== 'session_meta') continue;

    const payload = isRecord(obj.payload) ? obj.payload : {};
    return {
      id: typeof payload.id === 'string' ? payload.id : undefined,
      cwd: typeof payload.cwd === 'string' ? payload.cwd : undefined,
      startedAt: toIso(payload.timestamp),
    };
  }

  return {};
}

export function parseCodexSessionFile(content: string): Message[] {
  const lines = content.split('\n').filter(Boolean);
  const staged: Array<{ message: Message; origin: 'agent_message' | 'other' }> = [];
  let hasAssistantResponseItemText = false;

  for (const line of lines) {
    const obj = safeJsonParse(line);
    if (!isRecord(obj)) continue;

    const type = typeof obj.type === 'string' ? obj.type : undefined;
    const timestamp = toIso(obj.timestamp) || new Date().toISOString();

    if (type === 'event_msg') {
      const payload = isRecord(obj.payload) ? obj.payload : {};
      const eventType = typeof payload.type === 'string' ? payload.type : undefined;

      if (eventType === 'user_message' && typeof payload.message === 'string') {
        const text = payload.message.trim();
        if (!text) continue;
        staged.push({
          origin: 'other',
          message: {
            id: crypto.randomUUID(),
            type: 'user',
            timestamp,
            content: [{ type: 'text', text }],
          },
        });
      }

      // Avoid duplicating assistant text: prefer response_item assistant messages.
      if (
        !hasAssistantResponseItemText &&
        eventType === 'agent_message' &&
        typeof payload.message === 'string'
      ) {
        const text = payload.message.trim();
        if (!text) continue;
        staged.push({
          origin: 'agent_message',
          message: {
            id: crypto.randomUUID(),
            type: 'assistant',
            timestamp,
            content: [{ type: 'text', text }],
          },
        });
      }

      continue;
    }

    if (type === 'response_item') {
      const payload = isRecord(obj.payload) ? obj.payload : {};
      const payloadType = typeof payload.type === 'string' ? payload.type : undefined;

      if (payloadType === 'message') {
        const role = typeof payload.role === 'string' ? payload.role : undefined;
        if (role !== 'assistant') continue;
        const blocks = Array.isArray(payload.content) ? payload.content : [];
        const contentBlocks: ContentBlock[] = [];

        for (const b of blocks) {
          if (!isRecord(b)) continue;
          if (b.type === 'output_text' && typeof b.text === 'string') {
            const text = b.text.trim();
            if (!text) continue;
            contentBlocks.push({ type: 'text', text });
          }
        }

        if (contentBlocks.length > 0) {
          hasAssistantResponseItemText = true;
          staged.push({
            origin: 'other',
            message: {
              id: crypto.randomUUID(),
              type: 'assistant',
              timestamp,
              content: contentBlocks,
            },
          });
        }

        continue;
      }

      if (payloadType === 'function_call') {
        const name = typeof payload.name === 'string' ? payload.name : undefined;
        const argsRaw = payload.arguments as unknown;
        const callId = typeof payload.call_id === 'string' ? payload.call_id : undefined;
        if (!name || !callId) continue;

        const args = parseArguments(argsRaw);
        const toolUse = mapFunctionCallToToolUse(name, callId, args);

        staged.push({
          origin: 'other',
          message: {
            id: crypto.randomUUID(),
            type: 'assistant',
            timestamp,
            content: [toolUse],
          },
        });
        continue;
      }

      if (payloadType === 'function_call_output') {
        const callId = typeof payload.call_id === 'string' ? payload.call_id : undefined;
        if (!callId) continue;
        const output =
          typeof payload.output === 'string'
            ? payload.output
            : JSON.stringify(payload.output ?? null);

        staged.push({
          origin: 'other',
          message: {
            id: crypto.randomUUID(),
            type: 'assistant',
            timestamp,
            content: [
              {
                type: 'tool_result',
                tool_use_id: callId,
                content: output,
              },
            ],
          },
        });
      }
    }
  }

  if (hasAssistantResponseItemText) {
    return staged.filter((item) => item.origin !== 'agent_message').map((item) => item.message);
  }

  return staged.map((item) => item.message);
}
