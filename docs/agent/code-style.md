# Code Style

## Formatting & linting

- Use Biome (see `biome.json`).
- Prefer running:
  - `bun run check` (lint)
  - `bun run format` (format)

## TypeScript

- Keep strict typing (`tsconfig.json` is `strict: true`).
- Prefer small, composable functions and clear types for API shapes.

## Dependencies

- Avoid adding dependencies unless necessary (this is a small, focused tool).
- If you add or change behavior significantly, update `SPEC.md`.
