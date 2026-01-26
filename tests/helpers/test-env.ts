import { appendFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearConfigCache } from '../../src/config';

export interface TestEnvironment {
  rootDir: string;
  configPath: string;
  sessionsDir: string;
}

export async function createTestEnvironment(): Promise<TestEnvironment> {
  const rootDir = await mkdtemp(join(tmpdir(), 'agenttrail-test-'));
  const configPath = join(rootDir, 'config.json');
  const sessionsDir = join(rootDir, 'sessions');

  await mkdir(sessionsDir, { recursive: true });

  const config = {
    directories: [
      {
        path: sessionsDir,
        label: 'Test',
        color: '#10b981',
        enabled: true,
      },
    ],
    pins: [],
    customTags: {},
    server: { port: 9847 },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  process.env.AGENTTRAIL_CONFIG = configPath;
  clearConfigCache();

  return { rootDir, configPath, sessionsDir };
}

export async function cleanupTestEnvironment(env: TestEnvironment): Promise<void> {
  clearConfigCache();
  await rm(env.rootDir, { recursive: true, force: true });
}

export async function createTestSession(
  sessionsDir: string,
  projectName: string,
  sessionId: string,
  messages: unknown[],
): Promise<string> {
  const projectDir = join(sessionsDir, projectName);
  await mkdir(projectDir, { recursive: true });

  const sessionFile = join(projectDir, `${sessionId}.jsonl`);
  const lines = messages.map((m) => JSON.stringify(m)).join('\n');
  await writeFile(sessionFile, lines, 'utf-8');
  return sessionFile;
}

export async function appendToSession(sessionFile: string, message: unknown): Promise<void> {
  const line = `\n${JSON.stringify(message)}`;
  await appendFile(sessionFile, line, 'utf-8');
}
