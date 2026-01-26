import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from '../../src/server';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages } from '../fixtures/messages';

describe('search API', () => {
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

  it('returns empty results for empty query', async () => {
    const res = await app.handle(new Request('http://localhost/api/search?q='));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.results).toEqual([]);
  });

  it('supports quick mode', async () => {
    const res = await app.handle(new Request('http://localhost/api/search?q=login&mode=quick'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('quick');
    expect(Array.isArray(data.results)).toBe(true);
  });

  it('supports deep mode', async () => {
    const res = await app.handle(new Request('http://localhost/api/search?q=login&mode=deep'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('deep');
    expect(Array.isArray(data.results)).toBe(true);
  });
});
