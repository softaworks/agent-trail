import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from '../../src/server';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages } from '../fixtures/messages';

describe('sessions API', () => {
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

  it('GET /api/sessions returns sessions array', async () => {
    const res = await app.handle(new Request('http://localhost/api/sessions'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.sessions)).toBe(true);
    expect(data.sessions.length).toBeGreaterThan(0);
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
});
