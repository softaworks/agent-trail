import { describe, expect, it } from 'bun:test';
import { generateTags } from '../../src/tagger';
import { parseSessionFile } from '../../src/parser';

function messagesFromJsonl(lines: unknown[]): ReturnType<typeof parseSessionFile> {
  const content = lines.map((l) => JSON.stringify(l)).join('\n');
  return parseSessionFile(content);
}

describe('tagger', () => {
  it('detects keyword tags from content', () => {
    const messages = messagesFromJsonl([
      {
        type: 'user',
        message: { content: [{ type: 'text', text: 'Fix bug and add tests' }] },
      },
    ]);

    const tags = generateTags(messages);
    expect(tags).toContain('debugging');
    expect(tags).toContain('testing');
  });

  it('detects tool usage in tags', () => {
    const messages = messagesFromJsonl([
      {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              id: 'tool-1',
              input: { command: 'git status' },
            },
          ],
        },
      },
    ]);

    const tags = generateTags(messages);
    expect(tags).toContain('git');
  });

  it('limits to top 3 tags', () => {
    const messages = messagesFromJsonl([
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: 'Refactor UI and update API docs, add tests and config changes',
            },
          ],
        },
      },
    ]);

    const tags = generateTags(messages);
    expect(tags.length).toBeLessThanOrEqual(3);
  });
});
