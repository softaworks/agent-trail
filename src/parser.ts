// JSONL parsing for Claude Code session files

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking';
  text?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  input?: Record<string, unknown>;
  content?: string | ContentBlock[];
  thinking?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  timestamp: string;
  content: ContentBlock[];
}

export interface RawMessage {
  type: 'user' | 'assistant' | 'summary';
  message: {
    id?: string;
    content: ContentBlock[] | string;
  };
  timestamp?: string;
  isSidechain?: boolean;
}

// Clean system/internal content from text
function cleanSystemContent(text: string): string {
  let cleaned = text;

  // Remove all XML-style internal/system blocks with various prefixes
  cleaned = cleaned.replace(/<system-[a-z-]+>[\s\S]*?<\/system-[a-z-]+>/g, '');
  cleaned = cleaned.replace(/<local-command-[a-z-]+>[\s\S]*?<\/local-command-[a-z-]+>/g, '');
  cleaned = cleaned.replace(/<command-[a-z-]+>[\s\S]*?<\/command-[a-z-]+>/g, '');
  cleaned = cleaned.replace(/<user-prompt-[a-z-]+>[\s\S]*?<\/user-prompt-[a-z-]+>/g, '');
  cleaned = cleaned.replace(/<[a-z-]+-reminder>[\s\S]*?<\/[a-z-]+-reminder>/g, '');
  cleaned = cleaned.replace(/<[a-z-]+-caveat>[\s\S]*?<\/[a-z-]+-caveat>/g, '');
  cleaned = cleaned.replace(/<[a-z-]+-hook>[\s\S]*?<\/[a-z-]+-hook>/g, '');

  // Remove lines starting with "Caveat:"
  cleaned = cleaned.replace(/^Caveat:.*$/gm, '');

  // Clean up multiple newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

export function parseSessionFile(content: string): Message[] {
  const lines = content.trim().split('\n').filter(Boolean);
  const messages: Message[] = [];

  for (const line of lines) {
    try {
      const raw = JSON.parse(line) as RawMessage;

      // Skip summary messages and sidechains
      if (raw.type === 'summary' || raw.isSidechain) continue;

      // Normalize content to array
      let contentArray: ContentBlock[];
      if (typeof raw.message.content === 'string') {
        const cleanedText = cleanSystemContent(raw.message.content);
        if (!cleanedText) continue;
        contentArray = [{ type: 'text', text: cleanedText }];
      } else {
        // Filter and clean content blocks
        contentArray = raw.message.content
          .map((block) => {
            if (block.type === 'text' && block.text) {
              const cleanedText = cleanSystemContent(block.text);
              if (!cleanedText) return null;
              return { ...block, text: cleanedText };
            }
            return block;
          })
          .filter((block): block is ContentBlock => block !== null);

        if (contentArray.length === 0) continue;
      }

      messages.push({
        id: raw.message.id || crypto.randomUUID(),
        type: raw.type,
        timestamp: raw.timestamp || new Date().toISOString(),
        content: contentArray,
      });
    } catch {
      // Skip invalid lines
    }
  }

  return messages;
}

export function extractFirstUserMessage(messages: Message[]): string {
  for (const message of messages) {
    if (message.type !== 'user') continue;

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent?.text) continue;

    const text = textContent.text.trim();
    if (!text || text.length === 0) continue;

    // Skip command invocations
    if (text.startsWith('/') && !text.includes(' ')) continue;

    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length === 0) continue;

    return firstLine.length > 100 ? `${firstLine.slice(0, 100)}...` : firstLine;
  }

  return 'Untitled session';
}

// Generate a smart summary of the session
export function generateSessionSummary(messages: Message[]): string {
  const filesEdited: string[] = [];
  const filesRead: string[] = [];
  const toolsUsed = new Set<string>();
  let userIntent = '';

  for (const message of messages) {
    // Get first meaningful user message for intent
    if (message.type === 'user' && !userIntent) {
      const textContent = message.content.find((c) => c.type === 'text');
      if (textContent?.text) {
        const text = textContent.text.trim();
        if (text && !text.startsWith('/')) {
          userIntent = text.split('\n')[0].trim();
        }
      }
    }

    // Analyze tool usage
    for (const block of message.content) {
      if (block.type === 'tool_use' && block.name) {
        toolsUsed.add(block.name);

        const input = block.input as Record<string, unknown>;

        if (block.name === 'Edit' || block.name === 'Write') {
          const filePath = input?.file_path as string;
          if (filePath && !filesEdited.includes(filePath)) {
            filesEdited.push(filePath);
          }
        }

        if (block.name === 'Read') {
          const filePath = input?.file_path as string;
          if (filePath && !filesRead.includes(filePath)) {
            filesRead.push(filePath);
          }
        }
      }
    }
  }

  // Build summary based on activity
  if (userIntent) {
    let summary = userIntent;
    summary = summary.replace(/@[\w./-]+/g, '').trim();

    if (summary.length > 80) {
      summary = `${summary.slice(0, 80)}...`;
    }

    if (filesEdited.length > 0) {
      const fileNames = filesEdited
        .slice(0, 2)
        .map((f) => f.split('/').pop())
        .join(', ');
      if (filesEdited.length > 2) {
        summary += ` (edited ${fileNames} +${filesEdited.length - 2} more)`;
      } else if (summary.length < 60) {
        summary += ` (edited ${fileNames})`;
      }
    }

    return summary;
  }

  // Fallback: describe by activity
  if (filesEdited.length > 0) {
    const fileNames = filesEdited
      .slice(0, 3)
      .map((f) => f.split('/').pop())
      .join(', ');
    if (filesEdited.length > 3) {
      return `Edited ${fileNames} +${filesEdited.length - 3} more files`;
    }
    return `Edited ${fileNames}`;
  }

  if (filesRead.length > 0) {
    const fileNames = filesRead
      .slice(0, 3)
      .map((f) => f.split('/').pop())
      .join(', ');
    return `Explored ${fileNames}${filesRead.length > 3 ? ` +${filesRead.length - 3} more` : ''}`;
  }

  if (toolsUsed.size > 0) {
    const tools = Array.from(toolsUsed).slice(0, 3).join(', ');
    return `Session using ${tools}`;
  }

  return 'Untitled session';
}

// Session status detection
const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const RECENT_THRESHOLD_MS = 30 * 1000;

export function determineSessionStatus(
  messages: Message[],
  lastModified?: string,
): 'awaiting' | 'working' | 'idle' {
  if (messages.length === 0) return 'idle';

  const now = Date.now();
  let modifiedTime = now;

  if (lastModified) {
    modifiedTime = new Date(lastModified).getTime();
    if (now - modifiedTime > STALE_THRESHOLD_MS) {
      return 'idle';
    }
  }

  const lastMessage = messages[messages.length - 1];

  if (lastMessage.type === 'user') return 'working';

  const hasQuestion = lastMessage.content.some(
    (c) => c.type === 'tool_use' && c.name === 'AskUserQuestion',
  );
  if (hasQuestion) return 'awaiting';

  const hasToolUse = lastMessage.content.some((c) => c.type === 'tool_use');
  const hasToolResult = messages.some((m) =>
    m.content.some(
      (c) =>
        c.type === 'tool_result' &&
        lastMessage.content.some((tc) => tc.type === 'tool_use' && tc.id === c.tool_use_id),
    ),
  );

  if (hasToolUse && !hasToolResult) return 'working';

  if (lastModified && now - modifiedTime < RECENT_THRESHOLD_MS) {
    return 'working';
  }

  const hasTextContent = lastMessage.content.some(
    (c) => c.type === 'text' && c.text && c.text.trim().length > 0,
  );

  if (hasTextContent && !hasToolUse) {
    return 'awaiting';
  }

  return 'idle';
}
