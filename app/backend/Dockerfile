# syntax=docker/dockerfile:1

# ---- deps: full install (incl. dev) for building ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript -> dist ----
FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime: production deps + JRE (opendataloader-pdf spawns `java`) ----
FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openjdk-17-jre-headless ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 8000

# Default: REST API. Workers use the same image with a different command:
#   node dist/apps/ingestion-worker/main.js
#   node dist/apps/queue-producer/main.js
#   node dist/apps/notification-worker/main.js
#   node dist/apps/qualification-worker/main.js
CMD ["node", "dist/apps/api/server.js"]
