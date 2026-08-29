# Multi-stage Dockerfile for Backend Server
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build tools for better-sqlite3 compilation
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production Image
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl ffmpeg && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create runtime directories
RUN mkdir -p /app/data /recordings

# P1-17: Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5011/api/health || exit 1

EXPOSE 5011

CMD ["node", "dist/index.js"]
