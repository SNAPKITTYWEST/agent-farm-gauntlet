#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const WORM = path.join(ROOT, "worm");
const GENESIS_PREV_HASH = "0".repeat(64);

function sha256(data) {
  return crypto.createHash("sha256").update(data, "utf8").digest("hex");
}

function computeHash(entry) {
  const data = `${entry.seq}|${entry.type}|${entry.agent}|${entry.timestamp}|${JSON.stringify(entry.payload)}|${entry.prev_hash}`;
  return sha256(data);
}

function loadEntries() {
  const entries = [];
  const files = fs.readdirSync(WORM).filter(f => f.endsWith(".json") || f.endsWith(".jsonl")).sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(WORM, file), "utf8");
    if (file.endsWith(".jsonl")) {
      for (const line of content.split("\n").filter(l => l.trim())) {
        entries.push(JSON.parse(line));
      }
    } else {
      entries.push(JSON.parse(content));
    }
  }
  return entries;
}

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    const result = fn();
    if (result) {
      console.log(`  \x1b[32m✓\x1b[0m ${label}`);
      passed++;
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${label}`);
      failed++;
    }
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m ${label}: ${err.message}`);
    failed++;
  }
}

console.log("\nWORM Chain Verification\n");

const entries = loadEntries();
console.log(`Loaded ${entries.length} entries\n`);

check("Chain is not empty", () => entries.length > 0);

for (let i = 0; i < entries.length; i++) {
  const entry = entries[i];

  check(`Seq ${entry.seq}: sequence is ${i + 1}`, () => entry.seq === i + 1);

  if (i === 0) {
    check(`Seq ${entry.seq}: genesis prev_hash`, () => entry.prev_hash === GENESIS_PREV_HASH);
  } else {
    const prev = entries[i - 1];
    check(`Seq ${entry.seq}: prev_hash matches`, () => entry.prev_hash === prev.hash);
    check(`Seq ${entry.seq}: timestamp > previous`, () => entry.timestamp > prev.timestamp);
  }

  const computed = computeHash(entry);
  check(`Seq ${entry.seq}: hash matches`, () => computed === entry.hash);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
