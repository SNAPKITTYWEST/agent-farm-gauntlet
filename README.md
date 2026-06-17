# agent-farm-gauntlet

A minimal, production-ready Agent Task Ledger with WORM (Write-Once-Read-Many) audit trail, Ed25519 agent signing, and formal verification specs.

**Zero runtime dependencies.** TypeScript + Node.js native http + JSONL storage.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CONSTITUTION                             │
│  Supreme governance. Immutable.                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRUST DEED                               │
│  TD-GAUNTLET-001. Multi-party obligations.                  │
│  deployment_allowed := security ∧ compliance ∧ logic ∧ human│
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    AGENT RUNTIME                            │
│  HTTP server → Middleware → State machine → WORM ledger     │
│  Ed25519 signing → Hash chain → Atomic writes → File lock   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    WORM LEDGER                              │
│  Append-only JSONL. SHA-256 hash chain.                     │
│  Ed25519 signatures. Sealed segments.                       │
└─────────────────────────────────────────────────────────────┘
```

## Quickstart

```bash
git clone <repo>
cd agent-farm-gauntlet
npm install
npm run build
npm test
npm start
```

Server runs on `http://127.0.0.1:3847`.

## Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run build` | Compile TypeScript |
| `npm test` | Run 21 tests |
| `npm start` | Start server on :3847 |
| `npm run verify` | Build + test + chain verify |
| `npm run demo` | Run demo scenario |
| `npm run doctor` | Check environment |

## Security Model

### What is enforced at runtime

- **Ed25519 agent signing**: Every request signed with per-agent keypair
- **Hash chain integrity**: SHA-256 chain with `|` delimiters
- **Timestamp monotonicity**: Entries must have increasing timestamps
- **Sequence monotonicity**: Entries must be sequential (1, 2, 3...)
- **Atomic writes**: tmp → fsync → rename pattern
- **File locking**: PID-based stale lock detection
- **Body size limit**: 100KB maximum request body
- **State machine**: Task transitions validated (pending → in_progress → completed/rejected)

### What is modeled but not enforced

- **Lean 4 proofs**: Formal specifications with `sorry` placeholders
- **WORM immutability**: Read-only after seal (OS-level, not cryptographic)
- **Network isolation**: localhost binding only (no firewall enforcement)

### What is NOT enforced

- No external audit
- No consensus mechanism
- No Byzantine fault tolerance
- No key revocation
- No key rotation

## Proven vs Modeled

| Property | Status | Location |
|----------|--------|----------|
| Trust Deed validity → deployment allowed | **PROVEN** | `proofs/TrustDeed.lean:34` |
| Human approval required | **PROVEN** | `proofs/TrustDeed.lean:39` |
| Trust Deed is supreme | **PROVEN** | `proofs/TrustDeed.lean:82` |
| Completed tasks are terminal | **PROVEN** | `proofs/TaskInvariants.lean:33` |
| Rejected tasks are terminal | **PROVEN** | `proofs/TaskInvariants.lean:38` |
| Pending → completed invalid | **PROVEN** | `proofs/TaskInvariants.lean:43` |
| In-progress → pending invalid | **PROVEN** | `proofs/TaskInvariants.lean:48` |
| Tamper detection | **sorry** | `proofs/LedgerChain.lean:72` |
| Chain implies monotonicity | **sorry** | `proofs/LedgerChain.lean:87` |
| Ed25519 signature verification | **RUNTIME** | `src/agent-keys.ts` |
| Hash chain integrity | **RUNTIME** | `src/ledger.ts` |
| Atomic writes | **RUNTIME** | `src/file-lock.ts` |

## Project Structure

```
agent-farm-gauntlet/
├── constitution/          Governance documents (immutable)
├── deeds/                 Trust Deed TD-GAUNTLET-001
├── schemas/               JSON schemas for Task, LedgerEntry
├── agents/                Allowed agent registry
├── proofs/                Lean 4 formal specifications
├── apps/agent-task-ledger/
│   ├── src/               Production source (8 files, 996 lines)
│   └── tests/             Test suite (21 tests, 10 suites)
├── audit/                 Audit trail and reports
├── worm/                  WORM chain entries
└── scripts/               Operational scripts
```

## API

See [API.md](API.md) for full documentation.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/agents/:name/public-key` | Get agent's Ed25519 public key |
| POST | `/tasks` | Create task (signed) |
| GET | `/tasks` | List all tasks |
| GET | `/tasks/:id` | Get task by ID |
| POST | `/tasks/:id/start` | Start task (signed) |
| POST | `/tasks/:id/complete` | Complete task (signed) |
| POST | `/tasks/:id/reject` | Reject task (signed) |
| GET | `/worm` | View WORM chain |
| POST | `/worm/verify` | Verify chain integrity |

## License

MIT
