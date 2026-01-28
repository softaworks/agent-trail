import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolveUserPath(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  return p;
}
