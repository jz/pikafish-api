# Simple deployment using pre-built Pikafish binary
FROM node:18-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && \
    apt-get install -y curl p7zip-full ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Download and extract Pikafish
RUN curl -L -o /tmp/pikafish.7z \
    https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z && \
    cd /tmp && \
    7z x pikafish.7z && \
    mv /tmp/Linux/pikafish-bmi2 /app/pikafish && \
    mv /tmp/pikafish.nnue /app/pikafish.nnue && \
    chmod +x /app/pikafish && \
    rm -rf /tmp/pikafish.7z /tmp/Linux /tmp/Android /tmp/MacOS /tmp/Windows /tmp/Wiki

# Copy Node.js app
COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./

# Environment
ENV PORT=3000
ENV PIKAFISH_PATH=/app/pikafish

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
