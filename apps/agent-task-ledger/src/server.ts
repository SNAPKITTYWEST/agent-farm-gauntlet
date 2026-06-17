import * as http from "http";
import * as path from "path";
import { Ledger } from "./ledger";
import { TaskManager } from "./tasks";
import { isAgentName, AgentName } from "./types";
import { AgentKeyManager, AgentSignature } from "./agent-keys";

const DATA_DIR = path.join(__dirname, "..", "data");
const PORT = 3847;
const MAX_BODY_BYTES = 1024 * 100; // 100KB

const keyManager = new AgentKeyManager(DATA_DIR);
const ledger = new Ledger(DATA_DIR, keyManager);
const taskManager = new TaskManager(ledger, keyManager);

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body, null, 2));
}

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function requireSignedAgent(
  body: Record<string, unknown>,
  res: http.ServerResponse
): { agent: AgentName; sig: AgentSignature } | null {
  // Require agent_id
  if (!body.agent_id || typeof body.agent_id !== "string") {
    sendJson(res, 400, { error: "agent_id is required" });
    return null;
  }
  if (!isAgentName(body.agent_id)) {
    sendJson(res, 403, { error: "Unauthorized agent" });
    return null;
  }
  const agent = body.agent_id as AgentName;

  // Require signature fields
  if (!body.signature || typeof body.signature !== "string") {
    sendJson(res, 400, { error: "signature is required (Ed25519)" });
    return null;
  }
  if (!body.public_key || typeof body.public_key !== "string") {
    sendJson(res, 400, { error: "public_key is required" });
    return null;
  }

  // Build signature object for verification
  const sig: AgentSignature = {
    agent_id: agent,
    public_key: body.public_key as string,
    payload_hash: body.payload_hash as string || "",
    signature: body.signature as string,
    timestamp: body.timestamp as string || new Date().toISOString(),
    sequence: body.sequence as number || 0,
    previous_hash: body.previous_hash as string || "",
  };

  // Verify payload hash matches
  const payloadBody = JSON.stringify(body.payload || {});
  const expectedHash = keyManager.computePayloadHash(agent, payloadBody);
  if (expectedHash !== sig.payload_hash) {
    sendJson(res, 403, { error: "Payload hash mismatch" });
    return null;
  }

  // Verify Ed25519 signature
  const sigValid = keyManager.verifySignature(
    sig.public_key,
    sig.payload_hash,
    sig.signature
  );
  if (!sigValid) {
    sendJson(res, 403, { error: "Invalid Ed25519 signature" });
    return null;
  }

  // Verify public key matches expected agent
  const expectedPubKey = keyManager.getPublicKey(agent);
  if (sig.public_key !== expectedPubKey) {
    sendJson(res, 403, { error: "Public key does not match agent identity" });
    return null;
  }

  return { agent, sig };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const method = req.method || "GET";

  try {
    // POST /tasks — Create task (requires signature)
    if (method === "POST" && url.pathname === "/tasks") {
      const body = await parseBody(req);
      const signed = requireSignedAgent(body, res);
      if (!signed) return;

      if (!body.payload || typeof body.payload !== "object") {
        return sendJson(res, 400, { error: "payload object is required" });
      }
      const payload = body.payload as Record<string, unknown>;
      if (!payload.assignee || typeof payload.assignee !== "string" || !isAgentName(payload.assignee)) {
        return sendJson(res, 400, { error: "payload.assignee is required" });
      }

      const sig = keyManager.createSignature(
        signed.agent,
        JSON.stringify(payload),
        ledger.getLength() + 1,
        ledger.getLastHash()
      );

      const result = taskManager.createTask(
        payload.title as string,
        payload.description as string,
        payload.assignee
      );
      if (result.error) {
        return sendJson(res, 400, { error: result.error });
      }
      return sendJson(res, 201, { task: result.task, entry: result.entry });
    }

    // POST /tasks/:id/start — Start task (requires signature)
    const startMatch = url.pathname.match(/^\/tasks\/(task-[a-f0-9]+)\/start$/);
    if (method === "POST" && startMatch) {
      const taskId = startMatch[1];
      const body = await parseBody(req);
      const signed = requireSignedAgent(body, res);
      if (!signed) return;

      const result = taskManager.startTask(taskId, signed.agent);
      if (result.error) {
        const status = result.error.includes("Unauthorized") ? 403 : 400;
        return sendJson(res, status, { error: result.error });
      }
      return sendJson(res, 200, { task: result.task, entry: result.entry });
    }

    // POST /tasks/:id/complete — Complete task (requires signature)
    const completeMatch = url.pathname.match(/^\/tasks\/(task-[a-f0-9]+)\/complete$/);
    if (method === "POST" && completeMatch) {
      const taskId = completeMatch[1];
      const body = await parseBody(req);
      const signed = requireSignedAgent(body, res);
      if (!signed) return;

      const result = taskManager.completeTask(taskId, signed.agent);
      if (result.error) {
        const errLower = result.error.toLowerCase();
        const status = errLower.includes("unauthorized") || errLower.includes("not authorized") ? 403
          : errLower.includes("already completed") ? 409
          : 400;
        return sendJson(res, status, { error: result.error });
      }
      return sendJson(res, 200, { task: result.task, entry: result.entry });
    }

    // POST /tasks/:id/reject — Reject task (requires signature)
    const rejectMatch = url.pathname.match(/^\/tasks\/(task-[a-f0-9]+)\/reject$/);
    if (method === "POST" && rejectMatch) {
      const taskId = rejectMatch[1];
      const body = await parseBody(req);
      const signed = requireSignedAgent(body, res);
      if (!signed) return;

      const result = taskManager.rejectTask(taskId, signed.agent);
      if (result.error) {
        const status = result.error.includes("Unauthorized") ? 403 : 400;
        return sendJson(res, status, { error: result.error });
      }
      return sendJson(res, 200, { task: result.task, entry: result.entry });
    }

    // GET /tasks — List all tasks
    if (method === "GET" && url.pathname === "/tasks") {
      return sendJson(res, 200, { tasks: taskManager.getAllTasks() });
    }

    // GET /tasks/:id — Get task by ID
    const getTaskMatch = url.pathname.match(/^\/tasks\/(task-[a-f0-9]+)$/);
    if (method === "GET" && getTaskMatch) {
      const taskId = getTaskMatch[1];
      const task = taskManager.getTask(taskId);
      if (!task) {
        return sendJson(res, 404, { error: "Task not found" });
      }
      return sendJson(res, 200, { task });
    }

    // GET /worm — View WORM history
    if (method === "GET" && url.pathname === "/worm") {
      const chainCheck = ledger.verifyChain();
      return sendJson(res, 200, {
        entries: ledger.getEntries(),
        length: ledger.getLength(),
        chain_valid: chainCheck.valid,
        chain_error: chainCheck.error,
      });
    }

    // POST /worm/verify — Verify chain integrity
    if (method === "POST" && url.pathname === "/worm/verify") {
      const result = ledger.verifyChain();
      return sendJson(res, 200, result);
    }

    // GET /agents/:name/public-key — Get agent's public key
    const keyMatch = url.pathname.match(/^\/agents\/([A-Z]+)\/public-key$/);
    if (method === "GET" && keyMatch) {
      const agentName = keyMatch[1];
      if (!isAgentName(agentName)) {
        return sendJson(res, 404, { error: "Agent not found" });
      }
      return sendJson(res, 200, {
        agent: agentName,
        public_key: keyManager.getPublicKey(agentName as AgentName),
      });
    }

    // GET /health — Health check
    if (method === "GET" && url.pathname === "/health") {
      return sendJson(res, 200, {
        status: "ok",
        ledger_length: ledger.getLength(),
        chain_valid: ledger.verifyChain().valid,
        agents: ["FORGE", "SENTINEL", "LEDGE", "OPERATOR"],
      });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    console.error("Unhandled error:", err);
    return sendJson(res, 500, { error: "Internal server error" });
  }
});

if (require.main === module) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Agent Task Ledger running on http://127.0.0.1:${PORT}`);
    console.log(`Ledger entries: ${ledger.getLength()}`);
    console.log(`Chain valid: ${ledger.verifyChain().valid}`);
    console.log(`Agents loaded: FORGE, SENTINEL, LEDGE, OPERATOR`);
  });
}

export { server, ledger, taskManager, keyManager };
