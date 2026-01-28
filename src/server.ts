// ElysiaJS server with API routes and SSE

import { join } from 'node:path';
import { staticPlugin } from '@elysiajs/static';
import { Elysia, file, sse, t } from 'elysia';
import {
  addCustomTags,
  addDirectory,
  addPin,
  getConfigPath,
  loadConfig,
  removeCustomTag,
  removeDirectory,
  removePin,
  saveConfig,
  updateDirectory,
} from './config';
import { type SearchMode, search } from './search';
import {
  discoverSessions,
  getDirectoryList,
  getProjectList,
  getSessionById,
  getTagCounts,
} from './sessions';
import { sessionWatcher, type WatcherEvent } from './watcher';

interface PingEvent {
  type: 'ping';
  sessionId: string;
}

type QueuedEvent = WatcherEvent | PingEvent;

const PUBLIC_DIR = join(import.meta.dir, '..', 'public');

export function createServer() {
  const app = new Elysia()
    // Error handling for 404 and other errors
    .onError(({ code, set }) => {
      if (code === 'NOT_FOUND') {
        set.status = 404;
        return { error: 'Resource not found' };
      }
      if (code === 'VALIDATION') {
        set.status = 400;
        return { error: 'Validation failed' };
      }
      set.status = 500;
      return { error: 'Internal server error' };
    })

    // API Routes
    .get('/api/sessions', async () => {
      const sessions = await discoverSessions();
      return { sessions };
    })

    .get('/api/sessions/:id', async ({ params, status }) => {
      const session = await getSessionById(params.id);
      if (!session) {
        return status(404, { error: 'Session not found' });
      }
      return { session };
    })

    // SSE endpoint for live updates using ElysiaJS generator pattern
    .get('/api/sessions/:id/events', async function* ({ params }) {
      const sessionId = params.id;
      const session = await getSessionById(sessionId);

      if (!session) {
        return;
      }

      // Start watching this session
      await sessionWatcher.watchSession(sessionId, session.filePath);

      // Send initial status
      yield sse({
        event: 'status',
        data: { status: session.status },
      });

      // Set up event queue for incoming watcher events
      const eventQueue: QueuedEvent[] = [];
      let resolver: (() => void) | null = null;

      const unsubscribe = sessionWatcher.subscribe((event: WatcherEvent) => {
        if (event.sessionId !== sessionId) return;
        eventQueue.push(event);
        if (resolver) {
          resolver();
          resolver = null;
        }
      });

      // Keep-alive ping timer
      const keepAliveInterval = setInterval(() => {
        eventQueue.push({
          type: 'ping',
          sessionId,
        });
        if (resolver) {
          resolver();
          resolver = null;
        }
      }, 30000);

      try {
        while (true) {
          // Wait for events if queue is empty
          if (eventQueue.length === 0) {
            await new Promise<void>((resolve) => {
              resolver = resolve;
            });
          }

          // Process all queued events
          while (eventQueue.length > 0) {
            const event = eventQueue.shift();
            if (!event) continue;

            if (event.type === 'ping') {
              yield sse({
                event: 'ping',
                data: { time: Date.now() },
              });
            } else {
              yield sse({
                event: event.type,
                data: event.data,
              });
            }
          }
        }
      } finally {
        clearInterval(keepAliveInterval);
        unsubscribe();
      }
    })

    .get('/api/directories', async () => {
      const directories = await getDirectoryList();
      return { directories };
    })

    .get('/api/projects', async () => {
      const projects = await getProjectList();
      return { projects };
    })

    .get('/api/tags', async () => {
      const tags = await getTagCounts();
      return { tags };
    })

    .get('/api/search', async ({ query }) => {
      const q = (query.q as string) || '';
      const mode = (query.mode as SearchMode) || 'quick';

      if (!q) {
        return { results: [], mode, query: q, totalMatches: 0 };
      }

      const result = await search(q, mode);
      return result;
    })

    .get('/api/config', async () => {
      const config = await loadConfig();
      return { config, configPath: getConfigPath() };
    })

    .put(
      '/api/config',
      async ({ body }) => {
        await saveConfig(body);
        return { success: true, config: body };
      },
      {
        body: t.Object({
          directories: t.Array(
            t.Object({
              path: t.String(),
              label: t.String(),
              color: t.String(),
              enabled: t.Boolean(),
              type: t.Optional(t.Union([t.Literal('claude'), t.Literal('codex')])),
            }),
          ),
          pins: t.Array(t.String()),
          customTags: t.Record(t.String(), t.Array(t.String())),
          server: t.Object({
            port: t.Number(),
          }),
        }),
      },
    )

    .post(
      '/api/directories',
      async ({ body }) => {
        await addDirectory(body);
        const config = await loadConfig();
        return { success: true, directories: config.directories };
      },
      {
        body: t.Object({
          path: t.String(),
          label: t.String(),
          color: t.String(),
          enabled: t.Boolean(),
          type: t.Optional(t.Union([t.Literal('claude'), t.Literal('codex')])),
        }),
      },
    )

    .delete('/api/directories/:path', async ({ params }) => {
      const path = decodeURIComponent(params.path);
      await removeDirectory(path);
      const config = await loadConfig();
      return { success: true, directories: config.directories };
    })

    .put(
      '/api/directories/:path',
      async ({ params, body }) => {
        const path = decodeURIComponent(params.path);
        await updateDirectory(path, body);
        const config = await loadConfig();
        return { success: true, directories: config.directories };
      },
      {
        body: t.Partial(
          t.Object({
            path: t.String(),
            label: t.String(),
            color: t.String(),
            enabled: t.Boolean(),
            type: t.Optional(t.Union([t.Literal('claude'), t.Literal('codex')])),
          }),
        ),
      },
    )

    .post('/api/pins/:sessionId', async ({ params }) => {
      await addPin(params.sessionId);
      return { success: true, pinned: true };
    })

    .delete('/api/pins/:sessionId', async ({ params }) => {
      await removePin(params.sessionId);
      return { success: true, pinned: false };
    })

    .post(
      '/api/sessions/:id/tags',
      async ({ params, body }) => {
        await addCustomTags(params.id, body.tags);
        return { success: true };
      },
      {
        body: t.Object({
          tags: t.Array(t.String()),
        }),
      },
    )

    .delete('/api/sessions/:id/tags/:tag', async ({ params }) => {
      await removeCustomTag(params.id, params.tag);
      return { success: true };
    })

    // Static file serving using @elysiajs/static
    .use(
      staticPlugin({
        assets: PUBLIC_DIR,
        prefix: '/',
      }),
    )

    // SPA routes - serve index.html for client-side routing
    .get('/', () => file(join(PUBLIC_DIR, 'index.html')))
    .get('/session/:id', () => file(join(PUBLIC_DIR, 'index.html')));

  return app;
}
