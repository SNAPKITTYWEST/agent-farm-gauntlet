import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { AgentName, ALLOWED_AGENTS } from "./types";

export interface AgentKeyPair {
  agent: AgentName;
  publicKey: string;  // hex-encoded SPKI public key
  privateKey: string; // hex-encoded PKCS8 private key
}

export interface AgentSignature {
  agent_id: string;
  public_key: string;
  payload_hash: string;
  signature: string;
  timestamp: string;
  sequence: number;
  previous_hash: string;
}

export class AgentKeyManager {
  private keys: Map<AgentName, AgentKeyPair> = new Map();
  private keysDir: string;

  constructor(dataDir: string) {
    this.keysDir = path.join(dataDir, "keys");
    this.loadOrGenerateKeys();
  }

  private loadOrGenerateKeys(): void {
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }

    for (const agent of ALLOWED_AGENTS) {
      const keyFile = path.join(this.keysDir, `${agent}.json`);
      if (fs.existsSync(keyFile)) {
        const data = JSON.parse(fs.readFileSync(keyFile, "utf8"));
        this.keys.set(agent, {
          agent,
          publicKey: data.publicKey,
          privateKey: data.privateKey,
        });
      } else {
        const kp = this.generateKeyPair(agent);
        this.keys.set(agent, kp);
        fs.writeFileSync(keyFile, JSON.stringify(kp, null, 2), "utf8");
      }
    }
  }

  private generateKeyPair(agent: AgentName): AgentKeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });
    return {
      agent,
      publicKey: publicKey.toString("hex"),
      privateKey: privateKey.toString("hex"),
    };
  }

  getPublicKey(agent: AgentName): string {
    const kp = this.keys.get(agent);
    if (!kp) throw new Error(`No keypair for agent ${agent}`);
    return kp.publicKey;
  }

  getPrivateKey(agent: AgentName): string {
    const kp = this.keys.get(agent);
    if (!kp) throw new Error(`No keypair for agent ${agent}`);
    return kp.privateKey;
  }

  signPayload(agent: AgentName, payloadHash: string): string {
    const privateKeyDer = Buffer.from(this.getPrivateKey(agent), "hex");
    const keyObject = crypto.createPrivateKey({ key: privateKeyDer, format: "der", type: "pkcs8" });
    const data = Buffer.from(payloadHash, "utf8");
    const sigBuffer = crypto.sign(null, data, keyObject);
    return sigBuffer.toString("hex");
  }

  verifySignature(
    publicKeyHex: string,
    payloadHash: string,
    signatureHex: string
  ): boolean {
    try {
      const publicKeyDer = Buffer.from(publicKeyHex, "hex");
      const keyObject = crypto.createPublicKey({ key: publicKeyDer, format: "der", type: "spki" });
      const data = Buffer.from(payloadHash, "utf8");
      return crypto.verify(null, data, keyObject, Buffer.from(signatureHex, "hex"));
    } catch {
      return false;
    }
  }

  verifyAgentSignature(
    agent: AgentName,
    payloadHash: string,
    signatureHex: string
  ): boolean {
    const publicKey = this.getPublicKey(agent);
    return this.verifySignature(publicKey, payloadHash, signatureHex);
  }

  computePayloadHash(agentId: string, payloadBody: string): string {
    return crypto.createHash("sha256")
      .update(`${agentId}|${payloadBody}`)
      .digest("hex");
  }

  createSignature(
    agent: AgentName,
    payloadBody: string,
    seq: number,
    prevHash: string
  ): AgentSignature {
    const timestamp = new Date().toISOString();
    const payloadHash = this.computePayloadHash(agent, payloadBody);
    const signature = this.signPayload(agent, payloadHash);

    return {
      agent_id: agent,
      public_key: this.getPublicKey(agent),
      payload_hash: payloadHash,
      signature,
      timestamp,
      sequence: seq,
      previous_hash: prevHash,
    };
  }

  verifyFullSignature(sig: AgentSignature): boolean {
    if (!ALLOWED_AGENTS.includes(sig.agent_id as AgentName)) return false;
    const payloadHash = this.computePayloadHash(sig.agent_id, JSON.stringify({
      agent_id: sig.agent_id,
      public_key: sig.public_key,
      payload_hash: sig.payload_hash,
      timestamp: sig.timestamp,
      sequence: sig.sequence,
      previous_hash: sig.previous_hash,
    }));
    return this.verifySignature(sig.public_key, payloadHash, sig.signature);
  }
}
