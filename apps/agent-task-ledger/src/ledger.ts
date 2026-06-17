import * as fs from "fs";
import * as path from "path";
import {
  LedgerEntry,
  LedgerEntryType,
  AgentName,
} from "./types";
import { computeEntryHash } from "./hash";
import { AgentKeyManager, AgentSignature } from "./agent-keys";
import { FileLock, lockAndAppend } from "./file-lock";

const GENESIS_PREV_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

export class Ledger {
  private entries: LedgerEntry[] = [];
  private filePath: string;
  private keyManager: AgentKeyManager;
  private sealedUpTo: number = 0;
  private fileLock: FileLock;

  constructor(dataDir: string, keyManager: AgentKeyManager) {
    this.filePath = path.join(dataDir, "ledger.jsonl");
    this.keyManager = keyManager;
    this.fileLock = new FileLock(this.filePath);
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }
    const content = fs.readFileSync(this.filePath, "utf8");
    const lines = content.split("\n").filter((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]) as LedgerEntry;
        this.entries.push(entry);
      } catch {
        throw new Error(`Corrupt ledger entry at line ${i + 1} — halting`);
      }
    }
    const check = this.verifyChain();
    if (!check.valid) {
      throw new Error(`LEDGER INTEGRITY FAILURE: ${check.error} at seq ${check.brokenAt}`);
    }
  }

  getLength(): number {
    return this.entries.length;
  }

  getLastHash(): string {
    if (this.entries.length === 0) {
      return GENESIS_PREV_HASH;
    }
    return this.entries[this.entries.length - 1].hash;
  }

  getEntries(): readonly LedgerEntry[] {
    return this.entries;
  }

  sealSegment(upToSeq: number): void {
    if (upToSeq > this.sealedUpTo && upToSeq <= this.entries.length) {
      this.sealedUpTo = upToSeq;
      // Set file to read-only on Windows
      try {
        const stat = fs.statSync(this.filePath);
        fs.chmodSync(this.filePath, stat.mode | 0o444);
      } catch {
        // File may not exist yet on fresh ledger
      }
    }
  }

  isSealed(seq: number): boolean {
    return seq <= this.sealedUpTo;
  }

  append(
    type: LedgerEntryType,
    agent: AgentName | "SYSTEM",
    payload: Record<string, unknown>,
    signature?: AgentSignature
  ): LedgerEntry {
    // Reject if ledger is sealed at genesis level
    if (this.sealedUpTo > 0 && this.entries.length < this.sealedUpTo) {
      throw new Error("Ledger is sealed — cannot append to sealed segment");
    }

    const seq = this.entries.length + 1;
    const timestamp = new Date().toISOString();
    const prevHash = this.getLastHash();

    const hash = computeEntryHash(seq, type, agent, timestamp, payload, prevHash);

    const entry: LedgerEntry = {
      seq,
      type,
      agent,
      timestamp,
      payload,
      hash,
      prev_hash: prevHash,
    };

    if (signature) {
      entry.signature = signature.signature;
      entry.public_key = signature.public_key;
    }

    this.entries.push(entry);
    this.persist(entry);
    return entry;
  }

  private persist(entry: LedgerEntry): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic append with file locking
    const data = JSON.stringify(entry) + "\n";
    const tmpPath = this.filePath + ".tmp." + process.pid;

    // Read existing, append new, write to temp, rename
    const existing = fs.existsSync(this.filePath) ? fs.readFileSync(this.filePath, "utf8") : "";
    fs.writeFileSync(tmpPath, existing + data, "utf8");

    // fsync the temp file
    const fd = fs.openSync(tmpPath, "r+");
    fs.fsyncSync(fd);
    fs.closeSync(fd);

    // Atomic rename
    fs.renameSync(tmpPath, this.filePath);
  }

  verifyChain(): { valid: boolean; brokenAt: number | null; error: string | null } {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      // Sequence monotonicity
      if (entry.seq !== i + 1) {
        return {
          valid: false,
          brokenAt: entry.seq,
          error: `Sequence gap: expected seq ${i + 1}, got ${entry.seq}`,
        };
      }

      // Genesis prev_hash check
      if (i === 0 && entry.prev_hash !== GENESIS_PREV_HASH) {
        return {
          valid: false,
          brokenAt: 1,
          error: "Genesis entry has incorrect prev_hash",
        };
      }

      // Hash chain linkage
      if (i > 0) {
        const prev = this.entries[i - 1];
        if (entry.prev_hash !== prev.hash) {
          return {
            valid: false,
            brokenAt: entry.seq,
            error: `Hash chain broken at seq ${entry.seq}: prev_hash does not match previous entry hash`,
          };
        }

        // Timestamp monotonicity
        if (entry.timestamp <= prev.timestamp) {
          return {
            valid: false,
            brokenAt: entry.seq,
            error: `Non-monotonic timestamp at seq ${entry.seq}`,
          };
        }
      }

      // Hash recomputation
      const computed = computeEntryHash(
        entry.seq,
        entry.type,
        entry.agent,
        entry.timestamp,
        entry.payload as Record<string, unknown>,
        entry.prev_hash
      );

      if (computed !== entry.hash) {
        return {
          valid: false,
          brokenAt: entry.seq,
          error: `Entry hash mismatch at seq ${entry.seq}: computed ${computed} but stored ${entry.hash}`,
        };
      }

      // Signature verification (skip SYSTEM entries and pre-signing entries)
      if (entry.signature && entry.public_key && entry.agent !== "SYSTEM") {
        const payloadHash = this.keyManager.computePayloadHash(
          entry.agent,
          JSON.stringify(entry.payload)
        );
        const sigValid = this.keyManager.verifySignature(
          entry.public_key,
          payloadHash,
          entry.signature
        );
        if (!sigValid) {
          return {
            valid: false,
            brokenAt: entry.seq,
            error: `Invalid signature at seq ${entry.seq} for agent ${entry.agent}`,
          };
        }
      }
    }

    return { valid: true, brokenAt: null, error: null };
  }
}
