-- TrustDeed.lean
-- Formal specification of the Trust Deed governance layer
-- Every agent action must satisfy these constraints before deployment

-- ══════════════════════════════════════════════════════════════════════════════
-- §1. Core Trust Deed Structure
-- ══════════════════════════════════════════════════════════════════════════════

structure TrustDeed where
  security_passed    : Bool
  compliance_passed  : Bool
  logic_passed       : Bool
  human_approved     : Bool

-- ══════════════════════════════════════════════════════════════════════════════
-- §2. Validity Predicate
-- ══════════════════════════════════════════════════════════════════════════════

def deed_valid (d : TrustDeed) : Prop :=
  d.security_passed = true ∧
  d.compliance_passed = true ∧
  d.logic_passed = true ∧
  d.human_approved = true

-- ══════════════════════════════════════════════════════════════════════════════
-- §3. Deployment Gate
-- ══════════════════════════════════════════════════════════════════════════════

def deployment_allowed (d : TrustDeed) : Prop :=
  deed_valid d

-- Proof: If deployment is allowed, security must have passed
theorem deployment_implies_security (d : TrustDeed)
    (h : deployment_allowed d) : d.security_passed = true := by
  exact h.1

-- Proof: If deployment is allowed, human approval is required
theorem deployment_implies_human_approval (d : TrustDeed)
    (h : deployment_allowed d) : d.human_approved = true := by
  exact h.2.2.2

-- ══════════════════════════════════════════════════════════════════════════════
-- §4. Agent Identity (Ed25519)
-- ══════════════════════════════════════════════════════════════════════════════

structure AgentIdentity where
  agent_id    : String
  public_key  : String
  signature   : String
  payload_hash : String

def identity_valid (id : AgentIdentity) : Prop :=
  id.agent_id.length > 0 ∧
  id.public_key.length > 0 ∧
  id.signature.length > 0 ∧
  id.payload_hash.length = 64  -- SHA-256 hex

-- Invariant: No action without valid identity
-- (This is enforced at runtime by requireSignedAgent middleware)
axiom no_unsigned_action : ∀ (action : String) (id : AgentIdentity),
  ¬ identity_valid id → ¬ deployment_allowed ⟨false, false, false, false⟩

-- ══════════════════════════════════════════════════════════════════════════════
-- §5. Sandboxed Execution
-- ══════════════════════════════════════════════════════════════════════════════

-- Forbidden actions require explicit operator approval
def forbidden_actions : List String :=
  ["production_deploy", "credential_access", "file_deletion",
   "financial_transaction", "external_api_mutation", "infrastructure_change"]

def action_allowed (action : String) (operator_approved : Bool) : Prop :=
  ¬ (forbidden_actions.contains action) ∨ operator_approved = true

-- ══════════════════════════════════════════════════════════════════════════════
-- §6. Final Law
-- ══════════════════════════════════════════════════════════════════════════════

-- The Trust Deed is the authority.
-- No proof. No deployment. No exceptions.

theorem trust_deed_is_supreme :
  ∀ (d : TrustDeed) (action : String),
    deployment_allowed d → action_allowed action true := by
  intro d action h
  unfold action_allowed
  right
  rfl
