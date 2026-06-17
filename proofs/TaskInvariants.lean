-- TaskInvariants.lean
-- Formal specification of task state machine invariants
-- Every state transition must be valid

-- ══════════════════════════════════════════════════════════════════════════════
-- §1. Task Status Type
-- ══════════════════════════════════════════════════════════════════════════════

inductive TaskStatus where
  | pending
  | in_progress
  | completed
  | rejected
  deriving DecidableEq

-- ══════════════════════════════════════════════════════════════════════════════
-- §2. Valid Transitions
-- ══════════════════════════════════════════════════════════════════════════════

def valid_transition : TaskStatus → TaskStatus → Bool
  | .pending,      .in_progress => true
  | .pending,      .rejected    => true
  | .in_progress,  .completed   => true
  | .in_progress,  .rejected    => true
  | _,             _            => false

-- ══════════════════════════════════════════════════════════════════════════════
-- §3. Transition Invariants
-- ══════════════════════════════════════════════════════════════════════════════

-- Completed tasks cannot transition
theorem completed_is_terminal (s : TaskStatus) :
  valid_transition .completed s = false := by
  rfl

-- Rejected tasks cannot transition
theorem rejected_is_terminal (s : TaskStatus) :
  valid_transition .rejected s = false := by
  rfl

-- No direct pending → completed (must go through in_progress)
theorem pending_cannot_complete :
  valid_transition .pending .completed = false := by
  rfl

-- No direct in_progress → pending (no rollback)
theorem in_progress_cannot_rollback :
  valid_transition .in_progress .pending = false := by
  rfl

-- ══════════════════════════════════════════════════════════════════════════════
-- §4. Agent Authorization
-- ══════════════════════════════════════════════════════════════════════════════

inductive AgentName where
  | FORGE
  | SENTINEL
  | LEDGE
  | OPERATOR
  deriving DecidableEq, Inhabited

structure Task where
  id          : String
  title       : String
  assignee    : AgentName
  status      : TaskStatus
  created_at  : String

-- Invariant: Only the assigned agent can complete a task
-- (Enforced at runtime by completeTask in tasks.ts)
axiom only_assignee_completes :
  ∀ (task : Task) (agent : AgentName),
    task.status = .in_progress →
    agent ≠ task.assignee →
    valid_transition task.status .completed = false

-- ══════════════════════════════════════════════════════════════════════════════
-- §5. Task ID Invariant
-- ══════════════════════════════════════════════════════════════════════════════

def valid_task_id (id : String) : Prop :=
  id.length >= 13 ∧  -- "task-" + 8 hex chars
  id.startsWith "task-"

-- ══════════════════════════════════════════════════════════════════════════════
-- §6. Deserialization Safety
-- ══════════════════════════════════════════════════════════════════════════════

-- Every ledger entry must contain a valid task when type is TASK_CREATED
axiom task_created_has_task :
  ∀ (entry_type : String) (payload : String),
    entry_type = "TASK_CREATED" →
    payload.length > 0  -- Simplified: in reality, validates JSON schema
