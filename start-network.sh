#!/usr/bin/env bash
set -euo pipefail

# Start all services with network access (mirror npm run dev behavior)

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

export HOST=0.0.0.0
export VITE_HOST=0.0.0.0

# Prefer the smart dev orchestrator if available
if npm run | grep -q " dev$"; then
  NODE_OPTIONS="" VITE_NO_BROWSER=true VIBE_NO_BROWSER=true npm run dev:network
else
  # Fallback: start server, client and vibe-kanban in parallel
  npx concurrently \
    -n SERVER,CLIENT,VIBE \
    -c green,cyan,magenta \
    "npm:server:network" \
    "npm:client:network" \
    "npm:vibe-backend"
fi
