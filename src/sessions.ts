// Session discovery and metadata extraction for multi-directory support

import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { extractCodexSessionMeta, parseCodexSessionFile } from './codex-parser';
import {
  type AgentTrailConfig,
  type DirectoryConfig,
  type DirectoryType,
  getCustomTagsSync,
  isPinnedSync,
  loadConfig,
} from './config';
import {
  determineSessionStatus,
  generateSessionSummary,
  type Message,
  parseSessionFile,
} from './parser';
import { resolveUserPath } from './paths';
import { generateTags } from './tagger';

export interface Session {
  id: string;
  directory: string;
  directoryLabel: string;
  directoryColor: string;
  project: string;
  projectName: string;
  title: string;
  timestamp: string;
  lastModified: string;
  messageCount: number;
  tags: string[];
  status: 'awaiting' | 'working' | 'idle';
  filePath: string;
  isPinned: boolean;
  source: DirectoryType;
  assistantLabel: 'Claude' | 'Codex';
  chainId?: string;
  chainIndex?: number;
  chainLength?: number;
}

export interface SessionDetail extends Session {
  messages: Message[];
}

// Convert project directory name to path
async function projectDirToPath(dirName: string): Promise<string> {
  const stripped = dirName.startsWith('-') ? dirName.slice(1) : dirName;
  const parts = stripped.split('-');

  let currentPath = '/';
  let i = 0;

  while (i < parts.length) {
    let found = false;

    for (let len = parts.length - i; len >= 1; len--) {
      const segment = parts.slice(i, i + len).join('-');
      const testPath = join(currentPath, segment);

      try {
        const s = await stat(testPath);
        if (s.isDirectory()) {
          currentPath = testPath;
          i += len;
          found = true;
          break;
        }
      } catch {
        // Path doesn't exist
      }
    }

    if (!found) {
      currentPath = join(currentPath, parts.slice(i).join('-'));
      break;
    }
  }

  return currentPath;
}

function getProjectName(projectPath: string, encodedDir?: string): string {
  const parts = projectPath.split('/').filter(Boolean);
  const lastName = parts[parts.length - 1];

  if (lastName && lastName.length > 0) {
    return lastName;
  }

  if (encodedDir) {
    const match = encodedDir.match(/-code-(.+)$/);
    if (match) {
      return match[1];
    }
  }

  return projectPath;
}

// Group sessions into chains based on directory + project + title
function groupSessionsIntoChains(sessions: Session[]): Session[] {
  const chainMap = new Map<string, Session[]>();

  for (const session of sessions) {
    // Include directory in chain key for directory-isolated chaining
    const chainKey = `${session.directory}::${session.project}::${session.title.toLowerCase().trim()}`;

    if (!chainMap.has(chainKey)) {
      chainMap.set(chainKey, []);
    }
    chainMap.get(chainKey)?.push(session);
  }

  const result: Session[] = [];

  for (const [_, chainSessions] of chainMap) {
    chainSessions.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime(),
    );

    if (chainSessions.length === 1) {
      result.push(chainSessions[0]);
    } else {
      const chainId = chainSessions[0].id;

      chainSessions.forEach((session, index) => {
        result.push({
          ...session,
          chainId,
          chainIndex: index,
          chainLength: chainSessions.length,
        });
      });
    }
  }

  // Sort: pinned first, then by lastModified
  result.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
  });

  return result;
}

async function discoverSessionsInDirectory(
  dirConfig: DirectoryConfig,
  config: AgentTrailConfig,
): Promise<Session[]> {
  if (dirConfig.type === 'codex') {
    return discoverCodexSessionsInDirectory(dirConfig, config);
  }
  return discoverClaudeSessionsInDirectory(dirConfig, config);
}

async function discoverClaudeSessionsInDirectory(
  dirConfig: DirectoryConfig,
  config: AgentTrailConfig,
): Promise<Session[]> {
  const sessions: Session[] = [];

  try {
    const rootPath = resolveUserPath(dirConfig.path);
    const projectDirs = await readdir(rootPath);

    for (const projectDir of projectDirs) {
      const projectPath = join(rootPath, projectDir);
      const projectStat = await stat(projectPath);

      if (!projectStat.isDirectory()) continue;

      const files = await readdir(projectPath);
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl') && !f.startsWith('agent-'));

      for (const jsonlFile of jsonlFiles) {
        const filePath = join(projectPath, jsonlFile);
        const fileStat = await stat(filePath);

        try {
          const content = await readFile(filePath, 'utf-8');

          // Skip sidechain sessions
          const firstLine = content.split('\n')[0];
          if (firstLine) {
            try {
              const firstObj = JSON.parse(firstLine);
              if (firstObj.isSidechain === true) continue;
            } catch {
              // Ignore parse errors
            }
          }

          const messages = parseSessionFile(content);
          if (messages.length === 0) continue;

          const project = await projectDirToPath(projectDir);
          const sessionId = basename(jsonlFile, '.jsonl');
          const lastModifiedStr = fileStat.mtime.toISOString();
          const firstTimestamp = messages[0]?.timestamp || lastModifiedStr;
          const title = generateSessionSummary(messages);

          // Combine auto-tags with custom tags
          const autoTags = generateTags(messages);
          const customTags = getCustomTagsSync(config, sessionId);
          const allTags = [...new Set([...autoTags, ...customTags])];

          const status = determineSessionStatus(messages, lastModifiedStr);

          sessions.push({
            id: sessionId,
            directory: dirConfig.path,
            directoryLabel: dirConfig.label,
            directoryColor: dirConfig.color,
            project,
            projectName: getProjectName(project, projectDir),
            title,
            timestamp: firstTimestamp,
            lastModified: lastModifiedStr,
            messageCount: messages.length,
            tags: allTags,
            status,
            filePath,
            isPinned: isPinnedSync(config, sessionId),
            source: 'claude',
            assistantLabel: 'Claude',
          });
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  } catch (error) {
    console.error(`Error discovering sessions in ${dirConfig.path}:`, error);
  }

  return sessions;
}

async function walkJsonlFiles(rootPath: string): Promise<string[]> {
  const result: string[] = [];
  const stack: string[] = [rootPath];

  while (stack.length > 0) {
    const dir = stack.pop();
    if (!dir) continue;

    let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }> = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        result.push(fullPath);
      }
    }
  }

  return result;
}

async function discoverCodexSessionsInDirectory(
  dirConfig: DirectoryConfig,
  config: AgentTrailConfig,
): Promise<Session[]> {
  const sessions: Session[] = [];

  const rootPath = resolveUserPath(dirConfig.path);
  const jsonlFiles = await walkJsonlFiles(rootPath);

  for (const filePath of jsonlFiles) {
    try {
      const fileStat = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      const messages = parseCodexSessionFile(content);
      if (messages.length === 0) continue;

      const meta = extractCodexSessionMeta(content);
      const lastModifiedStr = fileStat.mtime.toISOString();
      const firstTimestamp = meta.startedAt || messages[0]?.timestamp || lastModifiedStr;

      const rawId = basename(filePath, '.jsonl');
      const sessionId = `codex:${rawId}`;

      const project = meta.cwd || 'Unknown';
      const projectName = meta.cwd
        ? meta.cwd.split('/').filter(Boolean).slice(-1)[0] || meta.cwd
        : 'Unknown';

      const title = generateSessionSummary(messages);

      const autoTags = generateTags(messages);
      const customTags = getCustomTagsSync(config, sessionId);
      const allTags = [...new Set([...autoTags, ...customTags])];

      const status = determineSessionStatus(messages, lastModifiedStr);

      sessions.push({
        id: sessionId,
        directory: dirConfig.path,
        directoryLabel: dirConfig.label,
        directoryColor: dirConfig.color,
        project,
        projectName,
        title,
        timestamp: firstTimestamp,
        lastModified: lastModifiedStr,
        messageCount: messages.length,
        tags: allTags,
        status,
        filePath,
        isPinned: isPinnedSync(config, sessionId),
        source: 'codex',
        assistantLabel: 'Codex',
      });
    } catch {
      // Skip files that can't be parsed
    }
  }

  return sessions;
}

export async function discoverSessions(): Promise<Session[]> {
  const config = await loadConfig();
  const allSessions: Session[] = [];

  // Discover sessions from all enabled directories
  const enabledDirs = config.directories.filter((d) => d.enabled);

  for (const dirConfig of enabledDirs) {
    const sessions = await discoverSessionsInDirectory(dirConfig, config);
    allSessions.push(...sessions);
  }

  return groupSessionsIntoChains(allSessions);
}

export async function getSessionById(sessionId: string): Promise<SessionDetail | null> {
  const sessions = await discoverSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) return null;

  try {
    const content = await readFile(session.filePath, 'utf-8');
    const messages =
      session.source === 'codex' ? parseCodexSessionFile(content) : parseSessionFile(content);

    return {
      ...session,
      messages,
    };
  } catch {
    return null;
  }
}

export async function getProjectList(): Promise<
  { name: string; path: string; directory: string; count: number }[]
> {
  const sessions = await discoverSessions();
  const projectMap = new Map<
    string,
    { name: string; path: string; directory: string; count: number }
  >();

  for (const session of sessions) {
    const key = `${session.directory}::${session.project}`;
    const existing = projectMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      projectMap.set(key, {
        name: session.projectName,
        path: session.project,
        directory: session.directory,
        count: 1,
      });
    }
  }

  return Array.from(projectMap.values()).sort((a, b) => b.count - a.count);
}

export async function getTagCounts(): Promise<Record<string, number>> {
  const sessions = await discoverSessions();
  const tagCounts: Record<string, number> = {};

  for (const session of sessions) {
    for (const tag of session.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return tagCounts;
}

export async function getDirectoryList(): Promise<
  {
    path: string;
    label: string;
    color: string;
    count: number;
    enabled: boolean;
    type: DirectoryType;
  }[]
> {
  const config = await loadConfig();
  const sessions = await discoverSessions();

  const dirCounts = new Map<string, number>();
  for (const session of sessions) {
    dirCounts.set(session.directory, (dirCounts.get(session.directory) || 0) + 1);
  }

  return config.directories.map((dir) => ({
    path: dir.path,
    label: dir.label,
    color: dir.color,
    count: dirCounts.get(dir.path) || 0,
    enabled: dir.enabled !== false,
    type: dir.type === 'codex' ? 'codex' : 'claude',
  }));
}

export async function searchSessions(query: string, mode: 'quick' | 'deep'): Promise<Session[]> {
  const sessions = await discoverSessions();
  const lowerQuery = query.toLowerCase();

  if (mode === 'quick') {
    // Quick search: titles, project names, tags only
    return sessions.filter((session) => {
      return (
        session.title.toLowerCase().includes(lowerQuery) ||
        session.projectName.toLowerCase().includes(lowerQuery) ||
        session.tags.some((t) => t.toLowerCase().includes(lowerQuery))
      );
    });
  } else {
    // Deep search: includes message content
    const results: Session[] = [];

    for (const session of sessions) {
      // First check quick fields
      if (
        session.title.toLowerCase().includes(lowerQuery) ||
        session.projectName.toLowerCase().includes(lowerQuery) ||
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
}
