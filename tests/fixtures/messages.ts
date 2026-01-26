export const simpleSessionMessages = [
  {
    type: 'user',
    message: {
      content: [{ type: 'text', text: 'Fix the bug in login' }],
    },
    timestamp: '2026-01-26T12:00:00.000Z',
  },
  {
    type: 'assistant',
    message: {
      content: [{ type: 'text', text: "I'll take a look." }],
    },
    timestamp: '2026-01-26T12:01:00.000Z',
  },
];

export const sessionWithTools = [
  {
    type: 'user',
    message: {
      content: [{ type: 'text', text: 'Create a file' }],
    },
    timestamp: '2026-01-26T12:02:00.000Z',
  },
  {
    type: 'assistant',
    message: {
      content: [
        { type: 'text', text: 'Creating file...' },
        {
          type: 'tool_use',
          name: 'Write',
          id: 'tool-1',
          input: { file_path: '/tmp/example.ts', content: 'hello' },
        },
      ],
    },
    timestamp: '2026-01-26T12:03:00.000Z',
  },
];

export const sessionWithThinking = [
  {
    type: 'user',
    message: {
      content: [{ type: 'text', text: 'Debug this' }],
    },
    timestamp: '2026-01-26T12:04:00.000Z',
  },
  {
    type: 'assistant',
    message: {
      content: [
        { type: 'thinking', thinking: 'Analyzing the problem...' },
        { type: 'text', text: 'Found it.' },
      ],
    },
    timestamp: '2026-01-26T12:05:00.000Z',
  },
];
