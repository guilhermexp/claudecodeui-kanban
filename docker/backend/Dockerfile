FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash \
    curl \
    build-base \
    libc6-compat

# Install Claude CLI globally
RUN npm install -g @anthropic-ai/claude-cli

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including native modules
RUN npm ci

# Copy server code
COPY server/ ./server/

# Copy environment file if exists
COPY .env* ./

# Create necessary directories
RUN mkdir -p /root/.claude/projects \
    && mkdir -p /app/data \
    && mkdir -p /app/uploads \
    && mkdir -p /app/temp

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "server/index.js"]