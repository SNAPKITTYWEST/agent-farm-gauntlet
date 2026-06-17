FROM node:18-alpine AS builder

WORKDIR /app

COPY apps/agent-task-ledger/package.json apps/agent-task-ledger/package-lock.json* ./
RUN npm install

COPY apps/agent-task-ledger/tsconfig.json apps/agent-task-ledger/
COPY apps/agent-task-ledger/tsconfig.test.json apps/agent-task-ledger/
COPY apps/agent-task-ledger/src/ apps/agent-task-ledger/src/

RUN npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/apps/agent-task-ledger/package.json ./
COPY --from=builder /app/apps/agent-task-ledger/dist/ ./dist/
COPY worm/ ./worm/
COPY constitution/ ./constitution/
COPY deeds/ ./deeds/
COPY schemas/ ./schemas/
COPY agents/ ./agents/
COPY proofs/ ./proofs/
COPY scripts/ ./scripts/

RUN addgroup -g 1001 -S gauntlet && \
    adduser -S gauntlet -u 1001 -G gauntlet && \
    mkdir -p apps/agent-task-ledger/data && \
    chown -R gauntlet:gauntlet /app

USER gauntlet

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3847/health || exit 1

CMD ["node", "dist/server.js"]
