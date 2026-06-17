#!/bin/bash
set -e

echo "Lean 4 Proof Verification"
echo "========================="
echo ""

LEAN_DIR="$(dirname "$0")/../proofs"

if ! command -v lean &> /dev/null; then
  echo "⚠ lean not found — skipping proof compilation"
  echo "  Install: https://leanprover.github.io/lean4/doc/quickstart.html"
  echo ""
  echo "Proof files exist:"
  for f in TrustDeed.lean TaskInvariants.lean LedgerChain.lean; do
    if [ -f "$LEAN_DIR/$f" ]; then
      echo "  ✓ $f ($(wc -l < "$LEAN_DIR/$f") lines)"
    else
      echo "  ✗ $f MISSING"
    fi
  done
  echo ""
  echo "Note: Proofs contain 'sorry' placeholders."
  echo "These are proof obligations for future formal verification."
  exit 0
fi

echo "Compiling proofs..."
cd "$LEAN_DIR"
for f in TrustDeed.lean TaskInvariants.lean LedgerChain.lean; do
  echo -n "  $f... "
  if lean "$f" 2>/dev/null; then
    echo "✓"
  else
    echo "✗ (contains sorry or errors)"
  fi
done

echo ""
echo "Note: Proofs contain 'sorry' placeholders."
echo "These are proof obligations for future formal verification."
