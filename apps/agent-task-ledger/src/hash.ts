import * as crypto from "crypto";

export function sha256(data: string): string {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

export function computeEntryHash(
  seq: number,
  type: string,
  agent: string,
  timestamp: string,
  payload: object,
  prevHash: string
): string {
  const data = `${seq}|${type}|${agent}|${timestamp}|${JSON.stringify(payload)}|${prevHash}`;
  return sha256(data);
}

export function verifyEntryHash(entry: {
  seq: number;
  type: string;
  agent: string;
  timestamp: string;
  payload: object;
  prev_hash: string;
  hash: string;
}): boolean {
  const computed = computeEntryHash(
    entry.seq,
    entry.type,
    entry.agent,
    entry.timestamp,
    entry.payload,
    entry.prev_hash
  );
  const a = Buffer.from(computed, "hex");
  const b = Buffer.from(entry.hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
