# AgentTrail

Local (self-hosted) web viewer to browse **Claude Code** and **Codex CLI** conversation history across **multiple profiles**.

[![CI](https://github.com/softaworks/agenttrail/actions/workflows/checks.yml/badge.svg)](https://github.com/softaworks/agenttrail/actions/workflows/checks.yml)
[![Coverage Status](https://coveralls.io/repos/github/softaworks/agenttrail/badge.svg?branch=main)](https://coveralls.io/github/softaworks/agenttrail?branch=main)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

AgentTrail scans configured folders (for example `~/.claude/projects` plus backups), lists sessions by project/profile, supports **quick/deep search**, **pinning**, **custom tags**, and live updates (SSE + file watch).

For the full specification (features, endpoints, UI), see `SPEC.md`.

## Why

Many viewers assume a single session location (usually `~/.claude`). AgentTrail adds:

- **Multi-profile** support via persistent config (`~/.config/agenttrail/config.json`)
- **Profile-isolated chaining** (sessions only chain within the same profile)
- **Pins and custom tags** that persist across restarts
- **Quick search** (client-side) and **deep search** (server-side, scans file content)
- **Live updates** while `.jsonl` session files change
- Support for **multiple session sources** (Claude + Codex) with per-profile configuration

## Requirements

- **Bun** `>= 1.0.0`

## Install (local dev)

```bash
bun install
```

## Usage

### Quickstart (no install)

```bash
# Bun
bunx agenttrail

# npm (still requires Bun installed on your machine)
npx -y agenttrail
```

### Run from source

Start the server:

```bash
bun run start
```

Open:

- `http://localhost:9847`

### CLI

The entrypoint is a CLI (`src/index.ts`) that starts the Elysia server:

```bash
# help
bun run start -- --help

# custom port
bun run start -- --port 8080

# initialize config (if it doesn't exist yet)
bun run start -- --init
```

Build the executable:

```bash
bun run build
./dist/cli.js --help
```

> If you publish/install this package, you can also run it as `agenttrail` or via `bunx agenttrail`.

## Configuration

### Location

`~/.config/agenttrail/config.json`

You can override the config location by setting `AGENTTRAIL_CONFIG` to a custom path (useful for testing or isolated instances).

On first run, if the config file does not exist, AgentTrail creates it and adds a default profile:
`~/.claude/projects`.

### Profile types (Claude vs Codex)

Each configured profile can declare a `type`:

- `claude` (default): expects Claude Code session layout (example: `~/.claude/projects`)
- `codex`: expects Codex CLI sessions (default path: `~/.codex/sessions`)

You can set this in the UI (**Settings**) when adding/editing a profile, or directly in the JSON.

### Example

```json
{
  "directories": [
    {
      "path": "/home/user/.claude/projects",
      "label": "Default",
      "color": "#7c3aed",
      "enabled": true,
      "type": "claude"
    },
    {
      "path": "/home/user/.codex/sessions",
      "label": "Codex",
      "color": "#10b981",
      "enabled": true,
      "type": "codex"
    }
  ],
  "pins": [],
  "customTags": {},
  "server": { "port": 9847 }
}
```

You can edit this in the UI (**Settings**) or edit the JSON directly.

## Privacy & security

AgentTrail reads session files from your local disk and serves a local UI/API. It does not send your content anywhere by itself.

## How it works (quick map)

- `src/index.ts`: CLI (args: `--port`, `--daemon`, `--init`)
- `src/server.ts`: API routes + SSE + static UI (`public/`)
- `src/config.ts`: config read/write (`~/.config/agenttrail/config.json`)
- `src/sessions.ts`: session discovery + metadata (title, tags, status)
- `src/parser.ts`: `.jsonl` parsing + removal of internal/system blocks from text
- `src/tagger.ts`: auto-tagging (e.g. `debugging`, `feature`, `git`, `docs`…)
- `src/search.ts`: quick/deep search
- `src/watcher.ts`: file watching + status debounce, feeding SSE
- `public/`: vanilla HTML/CSS/JS frontend consuming the API

## Notes / gotchas

- Configure profiles at the “projects” level (or equivalent): it expects project subfolders containing `.jsonl` files.
- Sidechain sessions and `summary` lines are ignored (focus is the main conversation).
- Deep search can be slower on large histories because it reads file contents.

## Development

```bash
# server with watch
bun run dev

# typecheck
bun run typecheck

# tests
bun test
bunx playwright test

# coverage
bun test --coverage --coverage-reporter=lcov tests/unit tests/api

# lint/format (Biome)
bun run check
bun run format
```

## Project structure

```
src/        # CLI + server + parsing/discovery
public/     # static UI
dist/       # build output (generated)
SPEC.md     # detailed spec
```

## Contributing

Contributions are welcome!

- Please read `CONTRIBUTING.md`.
- Run `bun run typecheck` and `bun run check` before opening a PR.

## Publishing

This repository is set up to publish to npm via GitHub Actions using **semantic-release**.

To enable publishing:

1. Create the package on npm (name: `agenttrail`).
2. Configure npm auth for GitHub Actions:
   - Option A: npm **Trusted Publishing** (OIDC) for this repo, or
   - Option B: set a repo secret `NPM_TOKEN` (classic automation token).

## Security

Please see `SECURITY.md`.

## Code of Conduct

Please see `CODE_OF_CONDUCT.md`.

## License

MIT. See `LICENSE`.
