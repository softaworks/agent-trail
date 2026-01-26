# Workflows

## Add a feature

1. Update backend behavior in `src/` (API/discovery/parser/search/watcher).
2. Update UI in `public/` if needed.
3. Update `SPEC.md` if behavior, endpoints, or UX changes.
4. Run:
   - `bun run typecheck`
   - `bun run check`
   - `bun run build`

## Fix a bug

1. Reproduce locally with `bun run dev`.
2. Prefer a minimal fix close to the source of truth (often `src/sessions.ts` or `src/parser.ts`).
3. Run the same checks as above.

## Releases / publishing

- Build output is produced by `bun run build` into `dist/` (ignored by git).
- Ensure README, LICENSE, and package metadata are accurate before publishing.
