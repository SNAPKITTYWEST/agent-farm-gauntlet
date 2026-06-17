#!/bin/bash
set -e

PORT=${PORT:-3848}
BASE_URL="http://127.0.0.1:$PORT"

echo "agent-farm-gauntlet demo"
echo "========================"
echo ""

# Build
echo "1. Building..."
cd "$(dirname "$0")/.."
npm run build --workspace=apps/agent-task-ledger 2>/dev/null

# Start server in background
echo "2. Starting server on port $PORT..."
node apps/agent-task-ledger/dist/server.js &
SERVER_PID=$!
sleep 2

cleanup() {
  echo ""
  echo "6. Stopping server..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Health check
echo "3. Health check..."
HEALTH=$(curl -s "$BASE_URL/health")
echo "   $HEALTH"
echo ""

# Get public key
echo "4. Agent public keys..."
FORGE_KEY=$(curl -s "$BASE_URL/agents/FORGE/public-key" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).public_key))")
echo "   FORGE: ${FORGE_KEY:0:16}..."
echo ""

# Create task
echo "5. Creating demo task..."
PAYLOAD='{"title":"Review security architecture","description":"Audit the WORM chain integrity","assignee":"SENTINEL"}'
PAYLOAD_HASH=$(echo -n "FORGE|$PAYLOAD" | sha256sum | cut -d' ' -f1)

# Sign with FORGE key (simplified — in production use actual Ed25519)
TASK_RESULT=$(curl -s -X POST "$BASE_URL/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"agent_id\": \"FORGE\",
    \"public_key\": \"$FORGE_KEY\",
    \"payload_hash\": \"$PAYLOAD_HASH\",
    \"signature\": \"demo-signature\",
    \"payload\": $PAYLOAD
  }")
echo "   $TASK_RESULT" | head -c 200
echo "..."
echo ""

# Verify chain
echo "6. Verifying WORM chain..."
CHAIN=$(curl -s -X POST "$BASE_URL/worm/verify")
echo "   $CHAIN"
echo ""

echo "Demo complete."
echo ""
echo "Full API available at $BASE_URL"
echo "Try: curl $BASE_URL/health"
echo "Try: curl $BASE_URL/worm"
