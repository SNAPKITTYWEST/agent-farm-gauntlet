# Failure Mode Reference

## F-001: INVALID_INPUT
- **Trigger**: Missing required fields in task creation (title, assignee)
- **Detection**: Schema validation rejects request
- **Response**: HTTP 400, ledger entry type REJECTED
- **Recovery**: Client corrects input and retries

## F-002: UNAUTHORIZED
- **Trigger**: Agent not in allowed set attempts action
- **Detection**: Agent identity check fails
- **Response**: HTTP 403, ledger entry type BREACH
- **Recovery**: SENTINEL review required

## F-003: DUPLICATE_ACTION
- **Trigger**: Agent attempts to complete already-completed task
- **Detection**: Task status check before state transition
- **Response**: HTTP 409, ledger entry type DUPLICATE
- **Recovery**: No action needed, idempotent

## F-004: LEDGER_CORRUPTION
- **Trigger**: Hash chain broken (previous hash mismatch)
- **Detection**: LEDGE agent chain verification
- **Response**: HTTP 500, all operations halted
- **Recovery**: OPERATOR manual review and chain repair

## F-005: CONSTITUTION_VIOLATION
- **Trigger**: Agent attempts forbidden action (network, deletion, etc.)
- **Detection**: SENTINEL code review
- **Response**: Immediate rejection, BREACH sealed to WORM
- **Recovery**: OPERATOR review, possible agent revocation

## F-006: TIMESTAMP_DRIFT
- **Trigger**: System clock differs from ledger timestamps
- **Detection**: LEDGE timestamp validation
- **Response**: Warning logged, entry flagged DRIFT
- **Recovery**: Clock synchronization required

## F-007: AGENT_IMPERSONATION
- **Trigger**: Agent claims identity without proper signing
- **Detection**: Signature verification failure
- **Response**: HTTP 403, BREACH sealed to WORM
- **Recovery**: SENTINEL investigation, key rotation
