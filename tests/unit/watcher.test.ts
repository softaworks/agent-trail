import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { sessionWatcher } from '../../src/watcher';
import { cleanupTestEnvironment, createTestEnvironment, createTestSession, appendToSession, type TestEnvironment } from '../helpers/test-env';
import { simpleSessionMessages } from '../fixtures/messages';

describe('sessionWatcher', () => {
  let env: TestEnvironment;

  beforeEach(async () => {
    env = await createTestEnvironment();
  });

  afterEach(async () => {
    sessionWatcher.unwatchAll();
    await cleanupTestEnvironment(env);
    delete process.env.AGENTTRAIL_CONFIG;
  });

  it('emits message and status updates on file changes', async () => {
    const sessionFile = await createTestSession(env.sessionsDir, 'project-a', 'session-1', simpleSessionMessages);

    const events: string[] = [];
    const unsubscribe = sessionWatcher.subscribe((event) => {
      events.push(event.type);
    });

    await sessionWatcher.watchSession('session-1', sessionFile);

    await appendToSession(sessionFile, {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'AskUserQuestion',
            id: 'q1',
            input: { prompt: 'Need input' },
          },
        ],
      },
      timestamp: new Date().toISOString(),
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout waiting for watcher')), 3000);
      const interval = setInterval(() => {
        if (events.includes('message') && events.includes('status')) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    unsubscribe();
  });

  it('debounces status updates on rapid changes', async () => {
    const sessionFile = await createTestSession(env.sessionsDir, 'project-a', 'session-2', simpleSessionMessages);

    const statuses: string[] = [];
    const unsubscribe = sessionWatcher.subscribe((event) => {
      if (event.type === 'status') {
        statuses.push(event.data.status);
      }
    });

    await sessionWatcher.watchSession('session-2', sessionFile);

    const now = new Date().toISOString();
    await appendToSession(sessionFile, {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'AskUserQuestion', id: 'q1', input: { prompt: 'Need input' } },
        ],
      },
      timestamp: now,
    });
    await appendToSession(sessionFile, {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'AskUserQuestion', id: 'q2', input: { prompt: 'Still need input' } },
        ],
      },
      timestamp: now,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout waiting for debounced status')), 3000);
      const interval = setInterval(() => {
        if (statuses.length >= 1) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });

    await new Promise((r) => setTimeout(r, 1200));
    expect(statuses.length).toBe(1);
    unsubscribe();
  });

  it('stops emitting after unwatch', async () => {
    const sessionFile = await createTestSession(env.sessionsDir, 'project-a', 'session-3', simpleSessionMessages);

    let count = 0;
    const unsubscribe = sessionWatcher.subscribe((event) => {
      if (event.sessionId === 'session-3') count++;
    });

    await sessionWatcher.watchSession('session-3', sessionFile);
    sessionWatcher.unwatchSession('session-3');

    await appendToSession(sessionFile, {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'After unwatch' }] },
      timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(count).toBe(0);
    unsubscribe();
  });

  it('unwatchAll clears all watchers', async () => {
    const sessionFile = await createTestSession(env.sessionsDir, 'project-a', 'session-4', simpleSessionMessages);

    let count = 0;
    const unsubscribe = sessionWatcher.subscribe(() => {
      count++;
    });

    await sessionWatcher.watchSession('session-4', sessionFile);
    sessionWatcher.unwatchAll();

    await appendToSession(sessionFile, {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'After unwatchAll' }] },
      timestamp: new Date().toISOString(),
    });

    await new Promise((r) => setTimeout(r, 300));
    expect(count).toBe(0);
    unsubscribe();
  });
});
