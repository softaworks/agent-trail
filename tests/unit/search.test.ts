import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { search } from '../../src/search';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages, sessionWithTools } from '../fixtures/messages';

describe('search', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment();
    await createTestSession(env.sessionsDir, 'project-a', 'session-1', simpleSessionMessages);
    await createTestSession(env.sessionsDir, 'project-b', 'session-2', sessionWithTools);
  });

  afterEach(async () => {
    await cleanupTestEnvironment(env);
    delete process.env.AGENTTRAIL_CONFIG;
  });

  it('returns results in quick mode', async () => {
    const result = await search('login', 'quick');
    expect(result.mode).toBe('quick');
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.totalMatches).toBe(result.results.length);
  });

  it('returns results in deep mode', async () => {
    const result = await search('Creating file', 'deep');
    expect(result.mode).toBe('deep');
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('returns empty for no matches', async () => {
    const result = await search('nonexistent-xyz-123', 'quick');
    expect(result.results).toHaveLength(0);
    expect(result.totalMatches).toBe(0);
  });
});
