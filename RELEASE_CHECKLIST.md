# Release Checklist

Use this checklist before every release.

## Clean Clone

- [ ] `git clone <repo>` into empty directory
- [ ] `cd agent-farm-gauntlet`
- [ ] No pre-existing node_modules, dist, or data directories

## Dependencies

- [ ] `npm install` succeeds
- [ ] No unexpected dependencies added
- [ ] package-lock.json is committed

## Build

- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] dist/ directory created with compiled output

## Tests

- [ ] `npm test` passes (21/21)
- [ ] No skipped tests
- [ ] No test timeouts

## WORM Chain

- [ ] `node scripts/verify-chain.js` passes
- [ ] All 8 entries verified
- [ ] Hash chain intact
- [ ] No sequence gaps
- [ ] No timestamp regressions

## Security

- [ ] No private keys committed (check `git log --all --full-history -- '*.key' '*.pem' '*/keys/*'`)
- [ ] No .env file committed
- [ ] No secrets in source code
- [ ] .gitignore excludes data/keys/
- [ ] No hardcoded credentials

## Documentation

- [ ] README.md is accurate
- [ ] API.md matches actual endpoints
- [ ] SECURITY.md reflects actual limitations
- [ ] Code comments match implementation
- [ ] No broken links in docs

## Governance

- [ ] Constitution unchanged (or changes documented)
- [ ] Trust Deed unchanged (or changes documented)
- [ ] WORM checkpoints sealed

## Manual Verification

- [ ] `npm start` serves on localhost:3847
- [ ] `curl http://127.0.0.1:3847/health` returns ok
- [ ] `curl http://127.0.0.1:3847/worm` returns entries
- [ ] `curl -X POST http://127.0.0.1:3847/worm/verify` returns valid

## Optional

- [ ] Docker build succeeds
- [ ] `docker compose up` works
- [ ] Lean 4 proofs compile (if lean is available)
