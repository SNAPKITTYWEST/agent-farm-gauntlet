# Constitution — Agent Farm Gauntlet

## Preamble

This constitution governs the agent-farm-gauntlet repository. It is the supreme constraint layer. No code, no agent output, no deployment may override it.

The Trust Deed embedded in this repository enforces one rule:

**No agent output becomes production code unless it satisfies this constitution and passes formal verification.**

## 1. Purpose

Build a minimal, production-ready Agent Task Ledger application using an inverted repository structure. The app must be small, real, runnable, tested, and audited.

## 2. What the App Is Allowed To Do

- Accept task creation requests (title, description, assignee)
- Assign tasks to named agents
- Mark tasks complete with signed audit events
- Store events in an append-only JSONL ledger
- Reject invalid agent actions (duplicate assignments, unauthorized completions)
- Produce SHA-256 integrity seals on each ledger entry
- Serve a local HTTP API on localhost only

## 3. What the App Is Forbidden From Doing

- Making external network calls (no HTTP clients, no webhooks, no APIs)
- Accessing environment variables containing secrets
- Writing files outside the working directory
- Deleting or mutating existing ledger entries
- Executing shell commands or spawning child processes
- Performing financial transactions
- Accessing credentials, tokens, or keys
- Deploying to remote servers

## 4. Failure Modes

| Mode | Trigger | Response |
|------|---------|----------|
| INVALID_INPUT | Missing required fields | Return 400, log to ledger as REJECTED |
| UNAUTHORIZED | Agent not in allowed set | Return 403, log to ledger as BREACH |
| DUPLICATE_ACTION | Task already completed | Return 409, log to ledger as DUPLICATE |
| LEDGER_CORRUPTION | Hash chain broken | Halt all operations, return 500 |
| CONSTITUTION_VIOLATION | Agent attempts forbidden action | Reject immediately, seal breach to WORM |

## 5. SENTINEL Stop Conditions

SENTINEL must halt the build and demand operator review if:

1. Any code attempts external network access
2. Any secret or credential is hardcoded in source
3. The constitution is weakened to make tests pass
4. A test is deleted rather than fixed
5. Ledger integrity (hash chain) is broken
6. Agent impersonation is possible (no signing verification)
7. The app writes outside its working directory
8. Shell command execution is possible through any input vector

## 6. Agent Roles

| Role | Responsibility |
|------|---------------|
| FORGE | Code generation, architecture, schemas |
| SENTINEL | Security audit, injection prevention, auth verification |
| LEDGE | WORM chain integrity, audit trail, event verification |
| OPERATOR | Human approval gate, stop conditions, final deployment |

## 7. WORM Protocol

Every significant action must be sealed to the append-only ledger:

- Entry includes: action type, agent, timestamp, SHA-256 hash, previous hash
- Entries are immutable once written
- Hash chain provides tamper evidence
- LEDGE agent verifies chain integrity at each checkpoint

## 8. Enforcement

This constitution is enforced by:

1. SENTINEL reviewing all code before it enters the repo
2. LEDGE verifying all ledger entries are properly sealed
3. Formal tests that validate constitution constraints
4. The operator (human) as the final authority

**No proof. No deployment. No exceptions.**
