#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "apps", "agent-task-ledger");
const SRC = path.join(APP, "src");
const DIST = path.join(APP, "dist");
const ROOT_DIST = path.join(ROOT, "dist");
const DATA = path.join(APP, "data");
const WORM = path.join(ROOT, "worm");
const PROOFS = path.join(ROOT, "proofs");

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

console.log("\nagent-farm-gauntlet doctor\n");

console.log("Environment:");
check("Node.js >= 18", () => {
  const v = process.version;
  const major = parseInt(v.slice(1).split(".")[0]);
  return major >= 18;
});

console.log("\nSource files:");
for (const f of ["types.ts", "hash.ts", "validation.ts", "ledger.ts", "tasks.ts", "server.ts", "agent-keys.ts", "file-lock.ts"]) {
  check(`src/${f}`, () => fs.existsSync(path.join(SRC, f)));
}

console.log("\nBuild output:");
check("dist/ exists", () => fs.existsSync(DIST));
check("dist/src/server.js", () => fs.existsSync(path.join(DIST, "src", "server.js")));

console.log("\nGovernance:");
for (const f of ["CONSTITUTION.md", "SENTINEL_RULES.md", "FAILURE_MODES.md"]) {
  check(`constitution/${f}`, () => fs.existsSync(path.join(ROOT, "constitution", f)));
}
check("deeds/TRUST_DEED.md", () => fs.existsSync(path.join(ROOT, "deeds", "TRUST_DEED.md")));

console.log("\nWORM chain:");
for (const f of ["001_GENESIS.json", "002_PHASE1_COMPLETE.json", "003_PHASE3_COMPLETE.json"]) {
  check(`worm/${f}`, () => fs.existsSync(path.join(WORM, f)));
}
check("worm/004_through_008_CHECKPOINTS.jsonl", () => fs.existsSync(path.join(WORM, "004_through_008_CHECKPOINTS.jsonl")));

console.log("\nProofs:");
for (const f of ["TrustDeed.lean", "TaskInvariants.lean", "LedgerChain.lean"]) {
  check(`proofs/${f}`, () => fs.existsSync(path.join(PROOFS, f)));
}

console.log("\nSecurity:");
check("No .env file", () => !fs.existsSync(path.join(ROOT, ".env")));
check("No private keys in repo", () => {
  const keysDir = path.join(DATA, "keys");
  return !fs.existsSync(keysDir);
});
check(".gitignore exists", () => fs.existsSync(path.join(ROOT, ".gitignore")));

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
