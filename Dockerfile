# Multi-stage build: compile Pikafish, then run Node server

# Stage 1: Build Pikafish for Linux
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone Pikafish source
RUN git clone https://github.com/official-pikafish/Pikafish.git . || \
    git clone https://github.com/pikafish/Pikafish.git .

# Build for Linux x86_64
RUN make -j$(nproc) build ARCH=x86-64-modern

# Stage 2: Runtime image with Node.js
FROM node:18-slim

WORKDIR /app

# Copy built Pikafish binary and NNUE file from builder
COPY --from=builder /build/src/pikafish /app/pikafish
COPY --from=builder /build/src/pikafish.nnue /app/pikafish.nnue

# Make binary executable
RUN chmod +x /app/pikafish

# Copy Node.js app
COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./

# Expose port (Railway sets PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start server
CMD ["node", "server.js"]
