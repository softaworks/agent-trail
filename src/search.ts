// Search implementation for AgentTrail

import { readFile } from 'node:fs/promises';
import { discoverSessions, type Session } from './sessions';

export type SearchMode = 'quick' | 'deep';

export interface SearchResult {
  results: Session[];
  mode: SearchMode;
  query: string;
  totalMatches: number;
}

// Quick search: titles, project names, tags only
export async function quickSearch(query: string): Promise<Session[]> {
  const sessions = await discoverSessions();
  const lowerQuery = query.toLowerCase();

  return sessions.filter((session) => {
    return (
      session.title.toLowerCase().includes(lowerQuery) ||
      session.projectName.toLowerCase().includes(lowerQuery) ||
      session.directoryLabel.toLowerCase().includes(lowerQuery) ||
      session.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  });
}

// Deep search: includes message content
export async function deepSearch(query: string): Promise<Session[]> {
  const sessions = await discoverSessions();
  const lowerQuery = query.toLowerCase();
  const results: Session[] = [];

  for (const session of sessions) {
    // First check quick fields
    if (
      session.title.toLowerCase().includes(lowerQuery) ||
      session.projectName.toLowerCase().includes(lowerQuery) ||
      session.directoryLabel.toLowerCase().includes(lowerQuery) ||
      session.tags.some((t) => t.toLowerCase().includes(lowerQuery))
    ) {
      results.push(session);
      continue;
    }

    // Then search message content
    try {
      const content = await readFile(session.filePath, 'utf-8');
      if (content.toLowerCase().includes(lowerQuery)) {
        results.push(session);
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return results;
}

export async function search(query: string, mode: SearchMode = 'quick'): Promise<SearchResult> {
  const results = mode === 'quick' ? await quickSearch(query) : await deepSearch(query);

  return {
    results,
    mode,
    query,
    totalMatches: results.length,
  };
}
