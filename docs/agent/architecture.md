# Architecture

## Overview

AgentTrail is a Bun + TypeScript project that serves:

- A **CLI** entrypoint that starts a web server (`src/index.ts`)
- An **Elysia** server with a JSON API and SSE (`src/server.ts`)
- A **static UI** (vanilla HTML/CSS/JS) (`public/`)

## Data Flow

1. User starts the CLI (optionally with `--port`, `--init`).
2. Server reads config from `~/.config/agenttrail/config.json` (`src/config.ts`).
3. Session discovery scans enabled directories, reading `.jsonl` files and producing metadata (`src/sessions.ts`).
4. UI calls API endpoints to list sessions, load session detail, search, manage pins/tags.
5. Live updates:
   - `src/watcher.ts` watches session files
   - `GET /api/sessions/:id/events` streams updates via SSE (`src/server.ts`)

## Key Concepts

- **Directories:** user-configured roots where Claude Code stores projects/sessions.
- **Session:** a `.jsonl` file; parsed and normalized by `src/parser.ts`.
- **Chain:** sessions grouped by `directory + project + normalized title` (directory-isolated).
- **Tags:**
  - Auto tags derived from content (`src/tagger.ts`)
  - Custom tags stored in config (`src/config.ts`)
- **Pins:** list of session IDs stored in config.

## Where to change what

- Add/adjust API behavior: `src/server.ts`
- Session discovery/parsing logic: `src/sessions.ts`, `src/parser.ts`
- Search behavior: `src/search.ts`
- Live update behavior: `src/watcher.ts`
- UI/UX changes: `public/index.html`, `public/app.js`, `public/styles.css`
