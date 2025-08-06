# Build stage
FROM rust:1.75-alpine AS builder

# Install build dependencies
RUN apk add --no-cache musl-dev openssl-dev pkgconfig

WORKDIR /app

# Copy the entire vibe-kanban directory
COPY vibe-kanban/ .

# Build the application
RUN cd backend && cargo build --release

# Runtime stage
FROM alpine:latest

# Install runtime dependencies
RUN apk add --no-cache \
    libgcc \
    openssl \
    ca-certificates \
    git

# Copy the built binary
COPY --from=builder /app/backend/target/release/vibe-kanban /usr/local/bin/vibe-kanban

# Create necessary directories
RUN mkdir -p /app/data

WORKDIR /app

# Set environment variables
ENV PORT=8081
ENV DATABASE_URL=/app/data/database.sqlite

EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1

CMD ["vibe-kanban"]