import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from '../../src/server';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages } from '../fixtures/messages';

describe('tags and pins API', () => {
  const app = createServer();
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment();
    await createTestSession(env.sessionsDir, 'project-a', 'session-1', simpleSessionMessages);
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
    delete process.env.AGENTTRAIL_CONFIG;
  });

  it('GET /api/tags returns tag counts', async () => {
    const res = await app.handle(new Request('http://localhost/api/tags'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tags).toBeDefined();
  });

  it('POST /api/sessions/:id/tags validates body', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/sessions/test/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: 'not-array' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('adds and removes custom tags', async () => {
    const addRes = await app.handle(
      new Request('http://localhost/api/sessions/session-1/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: ['important'] }),
      }),
    );
    expect(addRes.status).toBe(200);

    const removeRes = await app.handle(
      new Request('http://localhost/api/sessions/session-1/tags/important', { method: 'DELETE' }),
    );
    expect(removeRes.status).toBe(200);
  });

  it('pins and unpins session', async () => {
    const pinRes = await app.handle(
      new Request('http://localhost/api/pins/test-session', { method: 'POST' }),
    );
    expect(pinRes.status).toBe(200);
    const pinData = await pinRes.json();
    expect(pinData.pinned).toBe(true);

    const unpinRes = await app.handle(
      new Request('http://localhost/api/pins/test-session', { method: 'DELETE' }),
    );
    expect(unpinRes.status).toBe(200);
    const unpinData = await unpinRes.json();
    expect(unpinData.pinned).toBe(false);
  });
});
