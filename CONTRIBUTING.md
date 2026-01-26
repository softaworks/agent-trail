# Contributing to AgentTrail

Thanks for your interest in contributing!

## Getting Started

### Prerequisites

- **Bun** `>= 1.0.0`

### Setup

```bash
git clone https://github.com/softaworks/agenttrail.git
cd agenttrail
bun install
```

### Run locally

```bash
bun run dev
```

Open `http://localhost:9847`.

## Development Workflow

### Quality checks

Run these before opening a PR:

```bash
bun run typecheck
bun run check
```

### Build

```bash
bun run build
```

## What to change (and where)

- **Backend / CLI**: `src/`
- **UI** (static): `public/`
- **Detailed spec**: `SPEC.md`

If your change affects behavior or endpoints, please update `SPEC.md` accordingly.

## Pull Requests

- Keep PRs focused and small when possible.
- Prefer clear, user-facing behavior changes over refactors.
- Don’t add new dependencies unless there’s a strong reason.

## Reporting Issues

Please include:

- What you expected vs what happened
- Steps to reproduce
- OS + Bun version
- A screenshot or console logs (if UI-related)
