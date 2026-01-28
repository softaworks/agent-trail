import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clearConfigCache } from '../../src/config';
import { createServer } from '../../src/server';
import { sessionWatcher } from '../../src/watcher';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages } from '../fixtures/messages';

describe('sessions API', () => {
  const app = createServer();
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment();
    await createTestSession(env.sessionsDir, 'project-a', 'session-1', simpleSessionMessages);

    const codexRoot = join(env.rootDir, 'codex-sessions');
    const codexDayDir = join(codexRoot, '2026', '01', '28');
    await mkdir(codexDayDir, { recursive: true });
    const fixture = await readFile('tests/fixtures/codex/sessions/2026/01/28/rollout-test.jsonl', 'utf-8');
    await writeFile(join(codexDayDir, 'rollout-test.jsonl'), fixture, 'utf-8');

    const configRaw = await readFile(env.configPath, 'utf-8');
    const config = JSON.parse(configRaw) as any;
    config.directories = [
      { ...config.directories[0], type: 'claude' },
      { path: codexRoot, label: 'Codex', color: '#f97316', enabled: true, type: 'codex' },
    ];
    await writeFile(env.configPath, JSON.stringify(config, null, 2), 'utf-8');
    clearConfigCache();
  });

  afterAll(async () => {
    sessionWatcher.unwatchAll();
    await cleanupTestEnvironment(env);
    delete process.env.AGENTTRAIL_CONFIG;
  });

  it('GET /api/sessions returns sessions array', async () => {
    const res = await app.handle(new Request('http://localhost/api/sessions'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
  });

  it('includes Codex sessions when a codex directory is configured', async () => {
    const res = await app.handle(new Request('http://localhost/api/sessions'));
    expect(res.status).toBe(200);
    const data = await res.json();
    const codex = data.sessions.find((s: any) => s.source === 'codex');
    expect(codex).toBeDefined();
    expect(codex.assistantLabel).toBe('Codex');
    expect(String(codex.id)).toContain('codex:');
  });

  it('GET /api/sessions/:id returns 404 for invalid id', async () => {
    const res = await app.handle(new Request('http://localhost/api/sessions/invalid-id'));
    expect(res.status).toBe(404);
  });

  it('GET /api/sessions/:id returns session detail', async () => {
    const res = await app.handle(new Request('http://localhost/api/sessions/session-1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session.id).toBe('session-1');
    expect(data.session.messages.length).toBeGreaterThan(0);
  });

  it('GET /api/sessions/:id returns Codex session detail', async () => {
    const id = encodeURIComponent('codex:rollout-test');
    const res = await app.handle(new Request(`http://localhost/api/sessions/${id}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.session.source).toBe('codex');
    expect(data.session.assistantLabel).toBe('Codex');
    expect(data.session.messages.length).toBeGreaterThan(0);
    const hasBash = data.session.messages.some((m: any) =>
      Array.isArray(m.content) && m.content.some((b: any) => b.type === 'tool_use' && b.name === 'Bash'),
    );
    expect(hasBash).toBe(true);
  });

  it('GET /api/sessions/:id/events returns SSE stream', async () => {
    const controller = new AbortController();
    const res = await app.handle(
      new Request('http://localhost/api/sessions/session-1/events', {
        signal: controller.signal,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.headers.get('content-type') || '').toContain('text/event-stream');
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    const chunk = await reader?.read();
    const raw = chunk?.value as Uint8Array | string | undefined;
    const text =
      typeof raw === 'string' ? raw : raw ? new TextDecoder().decode(raw) : '';
    expect(text).toContain('event: status');
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
