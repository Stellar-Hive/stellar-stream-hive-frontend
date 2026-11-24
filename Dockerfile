# ---- Stage 1: install dependencies ----------------------------------------
# Uses the Node version from .nvmrc (20). The alpine variant keeps the image
# small. The deps stage is separate so Docker layer caching skips the
# npm install step when only application code changes.
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ---- Stage 2: build --------------------------------------------------------
# NEXT_PUBLIC_* variables are inlined into the JavaScript bundle at build
# time — they cannot be injected at runtime the way server-side env vars can.
# Pass each one as a --build-arg and set it as an ENV before running the build.
# See the "Deployment" section in README.md for the full list.
FROM node:20-alpine AS builder
WORKDIR /app

# Re-declare every NEXT_PUBLIC_* build argument here.
# Provide a default of an empty string so the build still succeeds for
# contributors who want to test the container without real contract IDs.
ARG NEXT_PUBLIC_STREAM_CONTRACT_ID=""
ARG NEXT_PUBLIC_VAULT_CONTRACT_ID=""
ARG NEXT_PUBLIC_REGISTRY_CONTRACT_ID=""
ARG NEXT_PUBLIC_STELLAR_NETWORK="TESTNET"
ARG NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
ARG NEXT_PUBLIC_SOROBAN_RPC_URL="https://soroban-testnet.stellar.org"
ARG NEXT_PUBLIC_API_BASE_URL=""
ARG NEXT_PUBLIC_MOCK_DATA=""
ARG NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ARG NEXT_PUBLIC_DOCS_URL=""

ENV NEXT_PUBLIC_STREAM_CONTRACT_ID=$NEXT_PUBLIC_STREAM_CONTRACT_ID
ENV NEXT_PUBLIC_VAULT_CONTRACT_ID=$NEXT_PUBLIC_VAULT_CONTRACT_ID
ENV NEXT_PUBLIC_REGISTRY_CONTRACT_ID=$NEXT_PUBLIC_REGISTRY_CONTRACT_ID
ENV NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK
ENV NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=$NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE
ENV NEXT_PUBLIC_SOROBAN_RPC_URL=$NEXT_PUBLIC_SOROBAN_RPC_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MOCK_DATA=$NEXT_PUBLIC_MOCK_DATA
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_DOCS_URL=$NEXT_PUBLIC_DOCS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---- Stage 3: production runner --------------------------------------------
# Copies only the Next.js standalone output, which includes the minimal server
# and the static assets — no node_modules tree is needed at runtime.
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# next.config.mjs sets output: "standalone", so the server entry point lives
# at .next/standalone/server.js.
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as a non-root user for security.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
