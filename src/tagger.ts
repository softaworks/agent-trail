// Auto-classification logic for sessions

import type { Message } from './parser';

export type Tag =
  | 'debugging'
  | 'feature'
  | 'refactoring'
  | 'git'
  | 'testing'
  | 'docs'
  | 'config'
  | 'api'
  | 'ui';

interface TagRule {
  tag: Tag;
  keywords: string[];
  toolPatterns?: string[];
}

const TAG_RULES: TagRule[] = [
  {
    tag: 'debugging',
    keywords: [
      'bug',
      'fix',
      'error',
      'issue',
      'broken',
      'not working',
      'failing',
      'crash',
      'debug',
      'investigate',
      '401',
      '404',
      '500',
      'exception',
      'undefined',
      'null',
    ],
  },
  {
    tag: 'feature',
    keywords: ['add', 'implement', 'create', 'build', 'new', 'feature', 'functionality', 'support'],
  },
  {
    tag: 'refactoring',
    keywords: [
      'refactor',
      'reorganize',
      'restructure',
      'clean up',
      'improve',
      'optimize',
      'simplify',
      'extract',
      'rename',
    ],
  },
  {
    tag: 'git',
    keywords: [
      'commit',
      'push',
      'pull',
      'merge',
      'branch',
      'git',
      'pr',
      'pull request',
      'rebase',
      'checkout',
    ],
    toolPatterns: ['git '],
  },
  {
    tag: 'testing',
    keywords: ['test', 'spec', 'jest', 'vitest', 'pytest', 'coverage', 'mock', 'stub', 'assert'],
    toolPatterns: ['test', 'jest', 'vitest', 'pytest'],
  },
  {
    tag: 'docs',
    keywords: ['document', 'readme', 'comment', 'explain', 'description', 'jsdoc', 'docstring'],
  },
  {
    tag: 'config',
    keywords: [
      'config',
      'configuration',
      'setup',
      'env',
      'environment',
      'settings',
      '.env',
      'package.json',
      'tsconfig',
    ],
  },
  {
    tag: 'api',
    keywords: [
      'api',
      'endpoint',
      'route',
      'request',
      'response',
      'rest',
      'graphql',
      'fetch',
      'http',
    ],
  },
  {
    tag: 'ui',
    keywords: [
      'ui',
      'css',
      'style',
      'component',
      'button',
      'form',
      'layout',
      'design',
      'frontend',
      'react',
      'vue',
      'html',
    ],
  },
];

export function generateTags(messages: Message[]): Tag[] {
  const tags = new Set<Tag>();

  // Collect all text content for analysis
  const textContent: string[] = [];

  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'text' && block.text) {
        textContent.push(block.text.toLowerCase());
      }
      if (block.type === 'tool_use') {
        if (block.name) {
          textContent.push(block.name.toLowerCase());
        }
        if (block.input) {
          textContent.push(JSON.stringify(block.input).toLowerCase());
        }
      }
    }
  }

  const fullText = textContent.join(' ');

  // Apply tag rules
  for (const rule of TAG_RULES) {
    const hasKeyword = rule.keywords.some((kw) => fullText.includes(kw));
    const hasToolPattern = rule.toolPatterns?.some((pattern) => fullText.includes(pattern));

    if (hasKeyword || hasToolPattern) {
      tags.add(rule.tag);
    }
  }

  // Limit to top 3 most relevant tags
  return Array.from(tags).slice(0, 3);
}
