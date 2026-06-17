# Agent Task Ledger

Minimal production-ready agent task ledger with WORM audit trail.

## Quick Start

```bash
cd apps/agent-task-ledger
npm install
npm run build
npm start
```

Server runs on `http://127.0.0.1:3847`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /tasks | Create task |
| GET | /tasks | List all tasks |
| GET | /tasks/:id | Get task by ID |
| POST | /tasks/:id/complete | Mark task complete |
| POST | /tasks/:id/reject | Reject task |
| GET | /worm | View WORM event history |
| POST | /worm/verify | Verify chain integrity |

## Task Object

```json
{
  "id": "task-a1b2c3d4",
  "title": "Review schema",
  "description": "Validate the task schema",
  "assignee": "SENTINEL",
  "status": "pending",
  "created_at": "2026-01-01T00:00:00.000Z",
  "completed_at": null,
  "completed_by": null
}
```

## Allowed Agents

- FORGE
- SENTINEL
- LEDGE
- OPERATOR

## WORM Chain

Every action is sealed to an append-only JSONL ledger. Each entry includes:

- Monotonic sequence number
- Event type
- Agent name
- ISO 8601 timestamp
- Payload
- SHA-256 hash of the entry
- Previous entry hash (hash chain)

Chain integrity is verified by `POST /worm/verify`.

## Run Tests

```bash
npm run build && npm test
```

## Architecture

```
constitution/   — Governance rules
deeds/          — Trust deed
schemas/        — JSON schemas
agents/         — Allowed agent list
runtime/        — (reserved)
apps/           — This application
tests/          — (reserved for integration tests)
audit/          — Audit reports
worm/           — WORM checkpoints
```
