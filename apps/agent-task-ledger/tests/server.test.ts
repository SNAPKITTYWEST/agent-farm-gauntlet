import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import * as crypto from "crypto";

const DATA_DIR = path.join(__dirname, "..", "data");
const TEST_PORT = 3848;

let server: http.Server;
let baseUrl: string;
let keysDir: string;

// Agent keypairs for testing
const agentKeys: Record<string, { publicKey: string; privateKey: string }> = {};

function loadTestKeys(): void {
  keysDir = path.join(DATA_DIR, "keys");
  if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
  }
  for (const agent of ["FORGE", "SENTINEL", "LEDGE", "OPERATOR"]) {
    const keyFile = path.join(keysDir, `${agent}.json`);
    if (fs.existsSync(keyFile)) {
      agentKeys[agent] = JSON.parse(fs.readFileSync(keyFile, "utf8"));
    } else {
      const kp = crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "der" },
        privateKeyEncoding: { type: "pkcs8", format: "der" },
      });
      agentKeys[agent] = {
        publicKey: kp.publicKey.toString("hex"),
        privateKey: kp.privateKey.toString("hex"),
      };
      fs.writeFileSync(keyFile, JSON.stringify(agentKeys[agent], null, 2), "utf8");
    }
  }
}

function signPayload(agent: string, payload: Record<string, unknown>): Record<string, unknown> {
  const privateKeyDer = Buffer.from(agentKeys[agent].privateKey, "hex");
  const keyObject = crypto.createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs8" });

  const payloadStr = JSON.stringify(payload);
  const payloadHash = crypto.createHash("sha256").update(`${agent}|${payloadStr}`).digest("hex");

  const data = Buffer.from(payloadHash, "utf8");
  const sigBuffer = crypto.sign(null, data, keyObject);

  return {
    agent_id: agent,
    public_key: agentKeys[agent].publicKey,
    payload_hash: payloadHash,
    signature: sigBuffer.toString("hex"),
    timestamp: new Date().toISOString(),
    sequence: 0,
    previous_hash: "0".repeat(64),
    payload,
  };
}

function httpRequest(
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, data });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

before(async () => {
  // Clean data dir
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Load/generate test keys
  loadTestKeys();

  // Dynamically import to get fresh ledger
  const mod = await import("../src/server");
  server = mod.server;
  baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  await new Promise<void>((resolve) => {
    server.listen(TEST_PORT, "127.0.0.1", resolve);
  });
});

after(() => {
  server.close();
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
  }
});

describe("Health", () => {
  it("GET /health returns ok with agent list", async () => {
    const res = await httpRequest("GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.data.status, "ok");
    assert.equal(res.data.chain_valid, true);
    assert.ok(res.data.agents.includes("FORGE"));
  });
});

describe("Agent Keys", () => {
  it("GET /agents/FORGE/public-key returns public key", async () => {
    const res = await httpRequest("GET", "/agents/FORGE/public-key");
    assert.equal(res.status, 200);
    assert.equal(res.data.agent, "FORGE");
    assert.ok(res.data.public_key.startsWith("302a")); // Ed25519 SPKI prefix
  });

  it("GET /agents/EVIL/public-key returns 404", async () => {
    const res = await httpRequest("GET", "/agents/EVIL/public-key");
    assert.equal(res.status, 404);
  });
});

describe("Signed Task CRUD", () => {
  let taskId: string;

  it("POST /tasks creates a signed task", async () => {
    const payload = {
      title: "Signed task",
      description: "A task with cryptographic identity",
      assignee: "FORGE",
    };
    const body = signPayload("FORGE", payload);
    const res = await httpRequest("POST", "/tasks", body);
    assert.equal(res.status, 201);
    assert.ok(res.data.task);
    assert.ok(res.data.entry);
    assert.equal(res.data.task.title, "Signed task");
    assert.equal(res.data.task.assignee, "FORGE");
    assert.equal(res.data.task.status, "pending");
    taskId = res.data.task.id;
  });

  it("GET /tasks/:id returns the signed task", async () => {
    const res = await httpRequest("GET", `/tasks/${taskId}`);
    assert.equal(res.status, 200);
    assert.equal(res.data.task.id, taskId);
  });

  it("POST /tasks/:id/start starts the task with signature", async () => {
    const body = signPayload("FORGE", {});
    const res = await httpRequest("POST", `/tasks/${taskId}/start`, body);
    assert.equal(res.status, 200);
    assert.equal(res.data.task.status, "in_progress");
  });

  it("POST /tasks/:id/complete completes the signed task", async () => {
    const body = signPayload("FORGE", {});
    const res = await httpRequest("POST", `/tasks/${taskId}/complete`, body);
    assert.equal(res.status, 200);
    assert.equal(res.data.task.status, "completed");
    assert.equal(res.data.task.completed_by, "FORGE");
  });

  it("POST /tasks/:id/complete rejects duplicate completion", async () => {
    const body = signPayload("FORGE", {});
    const res = await httpRequest("POST", `/tasks/${taskId}/complete`, body);
    assert.equal(res.status, 409);
    assert.ok(res.data.error.includes("already completed"));
  });
});

describe("Signature Verification", () => {
  it("rejects request without signature", async () => {
    const res = await httpRequest("POST", "/tasks", {
      agent_id: "FORGE",
      payload: { title: "No sig", assignee: "FORGE" },
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error.includes("signature"));
  });

  it("rejects request with invalid signature", async () => {
    const payload = { title: "Bad sig", assignee: "FORGE" };
    const body = signPayload("FORGE", payload);
    body.signature = "a".repeat(128); // Invalid signature
    const res = await httpRequest("POST", "/tasks", body);
    assert.equal(res.status, 403);
    assert.ok(res.data.error.includes("Invalid"));
  });

  it("rejects request with wrong agent's signature", async () => {
    const payload = { title: "Wrong agent", assignee: "FORGE" };
    const body = signPayload("SENTINEL", payload); // Sign as SENTINEL but claim FORGE
    body.agent_id = "FORGE";
    // Recompute payload hash for the spoofed agent_id
    const payloadStr = JSON.stringify(payload);
    body.payload_hash = crypto.createHash("sha256").update(`FORGE|${payloadStr}`).digest("hex");
    const res = await httpRequest("POST", "/tasks", body);
    assert.equal(res.status, 403);
  });

  it("rejects unknown agent", async () => {
    const res = await httpRequest("POST", "/tasks", {
      agent_id: "EVIL_AGENT",
      payload: { title: "Evil", assignee: "FORGE" },
    });
    assert.equal(res.status, 403);
  });
});

describe("Input validation (signed)", () => {
  it("rejects empty title", async () => {
    const body = signPayload("FORGE", { title: "", assignee: "FORGE" });
    const res = await httpRequest("POST", "/tasks", body);
    assert.equal(res.status, 400);
  });

  it("rejects missing assignee", async () => {
    const body = signPayload("FORGE", { title: "No assignee" });
    const res = await httpRequest("POST", "/tasks", body);
    assert.equal(res.status, 400);
  });
});

describe("Agent authorization (signed)", () => {
  it("rejects completion by wrong agent", async () => {
    // Create as SENTINEL
    const createBody = signPayload("SENTINEL", {
      title: "Auth test",
      assignee: "SENTINEL",
    });
    const createRes = await httpRequest("POST", "/tasks", createBody);
    const id = createRes.data.task.id;

    // Start as correct agent
    await httpRequest("POST", `/tasks/${id}/start`, signPayload("SENTINEL", {}));

    // Complete as wrong agent
    const res = await httpRequest("POST", `/tasks/${id}/complete`, signPayload("FORGE", {}));
    assert.equal(res.status, 403);
  });
});

describe("WORM chain (signed)", () => {
  it("GET /worm returns entries with valid chain", async () => {
    const res = await httpRequest("GET", "/worm");
    assert.equal(res.status, 200);
    assert.ok(res.data.entries.length > 0);
    assert.equal(res.data.chain_valid, true);
  });

  it("POST /worm/verify confirms chain integrity with signatures", async () => {
    const res = await httpRequest("POST", "/worm/verify");
    assert.equal(res.status, 200);
    assert.equal(res.data.valid, true);
    assert.equal(res.data.brokenAt, null);
  });
});

describe("Task rejection (signed)", () => {
  it("POST /tasks/:id/reject rejects a signed task", async () => {
    const createBody = signPayload("LEDGE", {
      title: "Reject test",
      assignee: "LEDGE",
    });
    const createRes = await httpRequest("POST", "/tasks", createBody);
    const id = createRes.data.task.id;

    const body = signPayload("LEDGE", {});
    const res = await httpRequest("POST", `/tasks/${id}/reject`, body);
    assert.equal(res.status, 200);
    assert.equal(res.data.task.status, "rejected");
  });
});

describe("WORM sealing", () => {
  it("sealSegment marks entries as sealed", async () => {
    const { ledger } = await import("../src/server");
    const length = ledger.getLength();
    assert.ok(length > 0);
    ledger.sealSegment(length);
    assert.equal(ledger.isSealed(1), true);
    assert.equal(ledger.isSealed(length), true);
    assert.equal(ledger.isSealed(length + 1), false);
  });

  it("chain remains valid after sealing", async () => {
    const { ledger } = await import("../src/server");
    const result = ledger.verifyChain();
    assert.equal(result.valid, true);
  });
});

describe("Atomic writes", () => {
  it("no temp files left after append", async () => {
    const { ledger } = await import("../src/server");
    const length = ledger.getLength();
    // Trigger an append via the API
    const body = signPayload("FORGE", {
      title: "Atomic test",
      assignee: "FORGE",
    });
    await httpRequest("POST", "/tasks", body);

    // Check no .tmp files remain
    const tmpFiles = fs.readdirSync(DATA_DIR).filter(f => f.includes(".tmp"));
    assert.equal(tmpFiles.length, 0, `Found temp files: ${tmpFiles.join(", ")}`);
  });
});
