# Allowed Agents

| Agent | Purpose | Permissions |
|-------|---------|-------------|
| FORGE | Code generation, architecture | Create tasks, complete assigned tasks |
| SENTINEL | Security audit | Create tasks, complete assigned tasks, reject tasks |
| LEDGE | Chain integrity | Create tasks, complete assigned tasks, seal entries |
| OPERATOR | Human authority | Override any action, approve deployment |

## Agent Identity

Each agent is identified by a fixed string: FORGE, SENTINEL, LEDGE, or OPERATOR.

Agent identity is validated by matching the agent field against this allowlist.

No other agent identities are permitted. Any unknown agent triggers F-002 (UNAUTHORIZED).

## Signing (Phase 1 scope)

In this minimal implementation, agent identity is validated by name matching.

Full cryptographic signing (Ed25519 per-agent wallets) is deferred to Phase 2.
