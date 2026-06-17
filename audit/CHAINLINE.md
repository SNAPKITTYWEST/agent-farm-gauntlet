# CHAINLINE — Prompt Orchestration Flow

## Overview

The Chainline defines the mandatory path every user intent must follow before producing output. No step may be skipped. No step may be reordered.

## Flow

```
USER INTENT
    │
    ▼
┌─────────────────────┐
│  CONSTITUTION CHECK  │  Does this intent violate any constitution clause?
│  (constitution/)     │  Is it forbidden? Does it trigger a stop condition?
└─────────┬───────────┘
          │ PASS
          ▼
┌─────────────────────┐
│     DEED CHECK       │  Does the trust deed permit this action?
│  (deeds/)            │  Are all party obligations satisfied?
└─────────┬───────────┘
          │ PASS
          ▼
┌─────────────────────┐
│  AGENT ASSIGNMENT    │  Which agent(s) handle this intent?
│  (agents/)           │  Is the agent in the allowed set?
└─────────┬───────────┘
          │ ASSIGNED
          ▼
┌─────────────────────┐
│  RUNTIME EXECUTION   │  Execute the intent within sandbox constraints.
│  (runtime/)          │  Log all actions to ledger.
└─────────┬───────────┘
          │ EXECUTED
          ▼
┌─────────────────────┐
│  SENTINEL REVIEW     │  Security audit of the execution.
│  (SENTINEL agent)    │  Check for injection, auth bypass, constitution violations.
└─────────┬───────────┘
          │ PASS
          ▼
┌─────────────────────┐
│    LEDGE SEAL        │  Verify hash chain integrity.
│  (LEDGE agent)       │  Append sealed entry to WORM chain.
└─────────┬───────────┘
          │ SEALED
          ▼
┌─────────────────────┐
│    WORM APPEND       │  Write to append-only ledger.
│  (worm/)             │  Compute hash, link to previous entry.
└─────────┬───────────┘
          │ WRITTEN
          ▼
┌─────────────────────┐
│   FINAL RESPONSE     │  Return result to user.
│  (output)            │  Include audit trail reference.
└─────────────────────┘
```

## Gate Rules

### Gate 1: Constitution Check
- **Input**: User intent
- **Check**: Does intent match any clause in constitution/CONSTITUTION.md?
- **Pass**: Intent is allowed
- **Fail**: Reject immediately, log REJECTED to WORM

### Gate 2: Deed Check
- **Input**: Allowed intent
- **Check**: Does deeds/TRUST_DEED.md permit this action for the requesting party?
- **Pass**: Deed permits action
- **Fail**: Reject, log DEED_VIOLATION to WORM

### Gate 3: Agent Assignment
- **Input**: Permitted intent
- **Check**: Is there an agent in agents/ALLOWED_AGENTS.md capable of handling this?
- **Pass**: Agent assigned
- **Fail**: Return error to user, no WORM entry needed

### Gate 4: Runtime Execution
- **Input**: Assigned intent
- **Check**: Execute within sandbox constraints (constitution/FAILURE_MODES.md)
- **Pass**: Execution complete
- **Fail**: Log EXECUTION_FAILURE to WORM, halt

### Gate 5: Sentinel Review
- **Input**: Execution output
- **Check**: SENTINEL reviews for security, injection, auth bypass
- **Pass**: Output approved
- **Fail**: Log BREACH to WORM, reject output, return to revision

### Gate 6: Ledge Seal
- **Input**: Approved output
- **Check**: LEDGE verifies hash chain integrity before writing
- **Pass**: Chain valid
- **Fail**: HALT (F-004: LEDGER_CORRUPTION)

### Gate 7: Worm Append
- **Input**: Sealed entry
- **Check**: Entry matches schema (schemas/ledger.json)
- **Pass**: Entry written
- **Fail**: HALT (corrupt entry)

### Gate 8: Final Response
- **Input**: Written entry
- **Action**: Return result to user with WORM reference

## Violation Handling

Any gate failure triggers:

1. Log the violation type and details
2. Seal a BREACH or REJECTED entry to WORM
3. Return control to OPERATOR if stop condition met
4. Do NOT weaken constitution to pass tests

## Override Protocol

Only OPERATOR may override a gate failure:

1. Document override in audit/OVERRIDES.md
2. Seal OVERRIDE event to WORM
3. Follow up with constitution review within 24 hours

## Example: Creating a Task

```
User: "Create a task to review the schema"
    │
    ├─ Constitution Check: ALLOWED (task creation is permitted)
    ├─ Deed Check: FORGE is obligated to generate code
    ├─ Agent Assignment: FORGE (code generation role)
    ├─ Runtime Execution: POST /tasks {title: "Review schema", assignee: "FORGE"}
    ├─ Sentinel Review: No injection, no auth bypass, input validated
    ├─ Ledge Seal: Hash chain intact, sequence monotonic
    ├─ Worm Append: TASK_CREATED entry sealed
    └─ Final Response: {task: {id: "task-abc12345", status: "pending"}}
```

## Example: Unauthorized Completion Attempt

```
User: "Complete task task-abc12345 as OPERATOR"
    │
    ├─ Constitution Check: ALLOWED (task completion is permitted)
    ├─ Deed Check: OPERATOR has override authority
    ├─ Agent Assignment: OPERATOR
    ├─ Runtime Execution: POST /tasks/task-abc12345/complete {agent: "OPERATOR"}
    ├─ Sentinel Review: OPERATOR is not assigned to this task
    ├─ Ledge Seal: BREACH entry sealed (UNAUTHORIZED_COMPLETION)
    ├─ Worm Append: BREACH entry written
    └─ Final Response: 403 "Agent not authorized to complete this task"
```

## Enforcement

This chainline is enforced by:

1. The constitution as the supreme constraint
2. SENTINEL reviewing all code and output
3. LEDGE verifying all ledger entries
4. OPERATOR as the final human authority

**No proof. No deployment. No exceptions.**
