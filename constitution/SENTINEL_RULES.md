# SENTINEL Stop Conditions — Active Rules

SENTINEL must immediately halt and request operator review when:

## Hard Stops (Immediate Halt)

1. **Network access attempted** — Any code making outbound HTTP/HTTPS calls
2. **Secrets in source** — Any hardcoded API key, password, token, or private key
3. **Constitution weakened** — Any change to constitution/CONSTITUTION.md that relaxes constraints
4. **Test deletion** — Any test file deleted rather than fixed
5. **Ledger mutation** — Any code that modifies existing WORM entries
6. **Shell execution** — Any use of exec, spawn, system(), or child_process
7. **Path traversal** — Any file write with user-controlled path without sanitization

## Soft Stops (Requires Justification)

8. **New dependency** — Any npm install or package addition
9. **File creation outside /apps** — New files outside the app directory
10. **Environment variable access** — Reading process.env (except NODE_ENV)
11. **Crypto algorithm change** — Changing from SHA-256 to another algorithm
12. **Agent set expansion** — Adding new agents beyond FORGE/SENTINEL/LEDGE/OPERATOR

## Verification Steps

Before each halt, SENTINEL must:

1. Log the violation type
2. Identify the exact file and line number
3. Seal the violation to WORM as a BREACH event
4. Return control to OPERATOR with findings

## Override Protocol

Only the OPERATOR (human) may override a SENTINEL stop. Override must be:

1. Explicitly requested by operator
2. Documented in audit/OVERRIDES.md
3. Sealed to WORM as an OVERRIDE event
4. Followed by a constitution review within 24 hours
