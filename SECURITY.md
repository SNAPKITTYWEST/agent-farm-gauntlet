# Security Policy

## Threat Model

This system is designed for **local, single-operator use**. It is NOT designed for:

- Multi-tenant deployments
- Internet-facing servers
- Untrusted environments
- Byzantine fault tolerance
- Consensus across multiple parties

## What This System Provides

### Cryptographic Agent Identity

Every agent (FORGE, SENTINEL, LEDGE, OPERATOR) has an Ed25519 keypair. Every request is signed. Signatures are verified at the middleware level.

**What this means:** An agent cannot impersonate another agent. Every action is non-repudiable.

**What this does NOT mean:** Keys are not rotated. There is no key revocation. There is no PKI.

### Tamper-Evident Audit Trail

Every WORM entry is SHA-256 hashed with `|` delimiters. Each entry's `prev_hash` links to the previous entry's `hash`. Modifying any entry breaks the chain.

**What this means:** Any modification to the audit trail is detectable.

**What this does NOT mean:** The chain is not cryptographically sealed. An attacker with file access could modify entries and recompute hashes. There is no external notarization.

### Atomic Writes

File writes use tmp → fsync → rename pattern. Partial writes are impossible.

**What this means:** The ledger cannot be corrupted by crashes during writes.

**What this does NOT mean:** This does not protect against concurrent access from multiple processes (file locking helps but is not bulletproof).

### State Machine

Task transitions are validated. You cannot complete a pending task. You cannot start a completed task.

**What this means:** The task lifecycle is predictable and auditable.

**What this does NOT mean:** This is not a workflow engine. There is no conditional logic, no branching, no parallel execution.

## What NOT to Claim

Do not claim:

- "Byzantine fault tolerant" — It is not.
- "Cryptographically sealed" — The WORM is hash-chained but not signed by an external party.
- "Formally verified" — The Lean 4 proofs contain `sorry` placeholders.
- "Production-ready for multi-party use" — It is single-operator only.
- "Key rotation supported" — It is not.
- "Network-isolated" — It binds to localhost but does not enforce network isolation at the OS level.

## Known Limitations

1. **No key rotation**: If a key is compromised, you must manually delete the key file and restart.
2. **No external audit**: The WORM chain is self-verified, not externally notarized.
3. **Single-process**: File locking helps but is not designed for multi-process access.
4. **No encryption at rest**: Ledger entries are plaintext JSON.
5. **No TLS**: HTTP only. Do not expose to untrusted networks.
6. **Lean 4 proofs incomplete**: Two theorems use `sorry` placeholders.

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it privately. Do not open a public issue.
