import { describe, expect, it } from 'bun:test';
import { extractCodexSessionMeta, parseCodexSessionFile } from '../../src/codex-parser';

describe('codex-parser', () => {
  it('extracts session_meta fields', () => {
    const content =
      '{"timestamp":"2026-01-28T11:01:55.045Z","type":"session_meta","payload":{"id":"abc","timestamp":"2026-01-28T11:01:55.045Z","cwd":"/tmp/project"}}\n' +
      '{"timestamp":"2026-01-28T11:01:56.000Z","type":"event_msg","payload":{"type":"user_message","message":"hi"}}\n';
    const meta = extractCodexSessionMeta(content);
    expect(meta.id).toBe('abc');
    expect(meta.cwd).toBe('/tmp/project');
    expect(meta.startedAt).toBe('2026-01-28T11:01:55.045Z');
  });

  it('parses user messages, assistant output_text, and tool calls', () => {
    const content =
      '{"timestamp":"2026-01-28T11:01:56.000Z","type":"event_msg","payload":{"type":"user_message","message":"hello"}}\n' +
      '{"timestamp":"2026-01-28T11:01:57.000Z","type":"response_item","payload":{"type":"function_call","name":"exec_command","arguments":"{\\"cmd\\":\\"echo hi\\"}","call_id":"call_1"}}\n' +
      '{"timestamp":"2026-01-28T11:01:58.000Z","type":"response_item","payload":{"type":"function_call_output","call_id":"call_1","output":"hi\\\\n"}}\n' +
      '{"timestamp":"2026-01-28T11:01:59.000Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"done"}]}}\n';

    const messages = parseCodexSessionFile(content);
    expect(messages.length).toBeGreaterThanOrEqual(3);

    const user = messages.find((m) => m.type === 'user');
    expect(user?.content[0]?.type).toBe('text');
    expect(user?.content[0]?.text).toContain('hello');

    const toolUseMsg = messages.find((m) => m.content.some((b) => b.type === 'tool_use'));
    const toolUse = toolUseMsg?.content.find((b) => b.type === 'tool_use');
    expect(toolUse?.name).toBe('Bash');
    expect(toolUse?.id).toBe('call_1');
    expect((toolUse?.input as any)?.command).toBe('echo hi');

    const toolResultMsg = messages.find((m) => m.content.some((b) => b.type === 'tool_result'));
    const toolResult = toolResultMsg?.content.find((b) => b.type === 'tool_result');
    expect(toolResult?.tool_use_id).toBe('call_1');
    expect(String(toolResult?.content)).toContain('hi');

    const assistantTextMsg = messages.find(
      (m) => m.type === 'assistant' && m.content.some((b) => b.type === 'text' && b.text?.includes('done')),
    );
    expect(assistantTextMsg).toBeDefined();
  });
});

