# API Documentation

**Base URL:** `http://127.0.0.1:3847`

All POST endpoints require Ed25519 signed requests.

## Signed Request Format

```json
{
  "agent_id": "FORGE",
  "public_key": "<hex-encoded-Ed25519-SPKI-public-key>",
  "payload_hash": "<SHA-256-hex-of-agentId|payloadJSON>",
  "signature": "<hex-encoded-Ed25519-signature>",
  "timestamp": "2026-06-16T00:00:00.000Z",
  "sequence": 1,
  "previous_hash": "<previous-entry-hash>",
  "payload": { ... }
}
```

---

## GET /health

Health check. No authentication required.

**Response:**
```json
{
  "status": "ok",
  "ledger_length": 3,
  "chain_valid": true,
  "agents": ["FORGE", "SENTINEL", "LEDGE", "OPERATOR"]
}
```

---

## GET /agents/:name/public-key

Get an agent's Ed25519 public key.

**Params:** `name` — one of FORGE, SENTINEL, LEDGE, OPERATOR

**Response:**
```json
{
  "agent": "FORGE",
  "public_key": "302a300506032b6570032100..."
}
```

**Errors:**
- `404` — Agent not found

---

## POST /tasks

Create a new task. Requires signed request.

**Request body (inside payload):**
```json
{
  "title": "Review schema",
  "description": "Audit the task schema for completeness",
  "assignee": "SENTINEL"
}
```

**Response (201):**
```json
{
  "task": {
    "id": "task-a1b2c3d4",
    "title": "Review schema",
    "description": "Audit the task schema for completeness",
    "assignee": "SENTINEL",
    "status": "pending",
    "created_at": "2026-06-16T00:00:00.000Z",
    "completed_at": null,
    "completed_by": null
  },
  "entry": {
    "seq": 4,
    "type": "TASK_CREATED",
    "agent": "SENTINEL",
    "timestamp": "2026-06-16T00:00:00.000Z",
    "hash": "abc123...",
    "prev_hash": "def456..."
  }
}
```

**Errors:**
- `400` — Invalid input (missing title, invalid assignee)
- `403` — Unauthorized agent or invalid signature

---

## GET /tasks

List all tasks. No authentication required.

**Response:**
```json
{
  "tasks": [
    {
      "id": "task-a1b2c3d4",
      "title": "Review schema",
      "assignee": "SENTINEL",
      "status": "pending",
      "created_at": "2026-06-16T00:00:00.000Z"
    }
  ]
}
```

---

## GET /tasks/:id

Get a specific task. No authentication required.

**Response:**
```json
{
  "task": {
    "id": "task-a1b2c3d4",
    "title": "Review schema",
    "assignee": "SENTINEL",
    "status": "pending",
    "created_at": "2026-06-16T00:00:00.000Z"
  }
}
```

**Errors:**
- `404` — Task not found

---

## POST /tasks/:id/start

Start a task. Requires signed request from the assigned agent.

**Request body:** Empty payload `{}`

**Response (200):**
```json
{
  "task": {
    "id": "task-a1b2c3d4",
    "status": "in_progress"
  },
  "entry": {
    "seq": 5,
    "type": "TASK_ASSIGNED"
  }
}
```

**Errors:**
- `400` — Invalid transition (e.g., starting a completed task)
- `403` — Not the assigned agent

---

## POST /tasks/:id/complete

Complete a task. Requires signed request from the assigned agent.

**Request body:** Empty payload `{}`

**Response (200):**
```json
{
  "task": {
    "id": "task-a1b2c3d4",
    "status": "completed",
    "completed_at": "2026-06-16T01:00:00.000Z",
    "completed_by": "SENTINEL"
  },
  "entry": {
    "seq": 6,
    "type": "TASK_COMPLETED"
  }
}
```

**Errors:**
- `403` — Not the assigned agent
- `409` — Task already completed

---

## POST /tasks/:id/reject

Reject a task. Requires signed request from the assigned agent.

**Request body:** Empty payload `{}`

**Response (200):**
```json
{
  "task": {
    "id": "task-a1b2c3d4",
    "status": "rejected"
  },
  "entry": {
    "seq": 6,
    "type": "TASK_REJECTED"
  }
}
```

**Errors:**
- `400` — Invalid transition
- `403` — Unauthorized agent

---

## GET /worm

View the WORM chain. No authentication required.

**Response:**
```json
{
  "entries": [
    {
      "seq": 1,
      "type": "CHECKPOINT",
      "agent": "SYSTEM",
      "hash": "5e3aeee...",
      "prev_hash": "0000000..."
    }
  ],
  "length": 3,
  "chain_valid": true,
  "chain_error": null
}
```

---

## POST /worm/verify

Verify WORM chain integrity. No authentication required.

**Response:**
```json
{
  "valid": true,
  "brokenAt": null,
  "error": null
}
```

If chain is broken:
```json
{
  "valid": false,
  "brokenAt": 5,
  "error": "Hash chain broken at seq 5: prev_hash does not match previous entry hash"
}
```

---

## Task State Machine

```
pending ──→ in_progress ──→ completed
                │
                └──→ rejected
```

Valid transitions:
- `pending` → `in_progress`
- `pending` → `rejected`
- `in_progress` → `completed`
- `in_progress` → `rejected`

Terminal states: `completed`, `rejected` (no further transitions)

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (invalid input) |
| 403 | Unauthorized (wrong agent or bad signature) |
| 404 | Not found |
| 409 | Conflict (duplicate action) |
| 500 | Internal server error (chain broken) |
