import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createServer } from '../../src/server';
import { cleanupTestEnvironment, createTestEnvironment, type TestEnvironment } from '../helpers/test-env';

describe('directories API', () => {
  const app = createServer();
  let env: TestEnvironment;

  beforeAll(async () => {
    env = await createTestEnvironment();
  });

  afterAll(async () => {
    await cleanupTestEnvironment(env);
    delete process.env.AGENTTRAIL_CONFIG;
  });

  it('GET /api/directories returns directories array', async () => {
    const res = await app.handle(new Request('http://localhost/api/directories'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.directories)).toBe(true);
  });

  it('POST /api/directories validates body', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/tmp/test' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('POST /api/directories adds directory', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/directories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/tmp/test',
          label: 'Test',
          color: '#fff',
          enabled: true,
        }),
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.directories.some((d: { path: string }) => d.path === '/tmp/test')).toBe(true);
  });

  it('PUT /api/directories/:path updates directory', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/directories/${encodeURIComponent('/tmp/test')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'Updated' }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it('DELETE /api/directories/:path removes directory', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/directories/${encodeURIComponent('/tmp/test')}`, {
        method: 'DELETE',
      }),
    );
    expect(res.status).toBe(200);
  });
});
