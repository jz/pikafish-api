# Simple deployment using pre-built Pikafish binary
FROM node:18-slim

WORKDIR /app

# Install curl for downloads and healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Download pre-built Pikafish binary (avx2 for best compatibility on modern servers)
RUN curl -L -o /tmp/pikafish.7z https://github.com/official-pikafish/Pikafish/releases/download/Pikafish-2026-01-02/Pikafish.2026-01-02.7z && \
    apt-get update && apt-get install -y p7zip-full && \
    7z e /tmp/pikafish.7z -o/app Linux/pikafish-bmi2 pikafish.nnue -r && \
    mv /app/pikafish-bmi2 /app/pikafish && \
    chmod +x /app/pikafish && \
    rm /tmp/pikafish.7z && \
    apt-get remove -y p7zip-full && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy Node.js app
COPY package*.json ./
RUN npm ci --only=production

COPY server.js ./

# Expose port (Railway sets PORT env var)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Start server
CMD ["node", "server.js"]
