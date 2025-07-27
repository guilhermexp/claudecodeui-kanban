#!/bin/bash

# Improved startup script with better error handling and monitoring

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
PID_DIR="$SCRIPT_DIR/.pids"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Log function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_DIR/startup.log"
}

# Check if a port is available
check_port() {
    local port=$1
    if lsof -i:$port >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Wait for a service to be ready
wait_for_service() {
    local name=$1
    local port=$2
    local health_url=$3
    local timeout=${4:-30}
    
    log "INFO" "Waiting for $name to be ready on port $port..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        if ! check_port $port; then
            # Port is in use, check health
            if [ -n "$health_url" ]; then
                if curl -s -f "$health_url" >/dev/null 2>&1; then
                    log "SUCCESS" "$name is ready!"
                    return 0
                fi
            else
                log "SUCCESS" "$name is listening on port $port"
                return 0
            fi
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done
    
    echo ""
    log "ERROR" "$name failed to start within $timeout seconds"
    return 1
}

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up processes..."
    
    # Read PIDs from files and kill them gracefully
    for pid_file in "$PID_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if kill -0 $pid 2>/dev/null; then
                log "INFO" "Stopping process $pid"
                kill -TERM $pid 2>/dev/null || true
                sleep 2
                kill -KILL $pid 2>/dev/null || true
            fi
            rm -f "$pid_file"
        fi
    done
    
    # Cleanup any orphaned processes on our ports
    for port in 8080 8081 9000; do
        if pid=$(lsof -ti:$port); then
            log "WARN" "Killing orphaned process on port $port (PID: $pid)"
            kill -9 $pid 2>/dev/null || true
        fi
    done
}

# Trap for cleanup on exit
trap cleanup EXIT INT TERM

# Start function with proper error handling
start_service() {
    local name=$1
    local command=$2
    local port=$3
    local health_url=$4
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"
    
    log "INFO" "Starting $name..."
    
    # Check if port is already in use
    if ! check_port $port; then
        log "WARN" "Port $port is already in use, attempting to clean up..."
        if pid=$(lsof -ti:$port); then
            kill -9 $pid 2>/dev/null || true
            sleep 2
        fi
    fi
    
    # Start the service
    if [[ "$name" == "vibe-backend" ]]; then
        # Special handling for Rust backend
        cd "$SCRIPT_DIR/vibe-kanban/backend"
        if [ -f "target/release/vibe-kanban" ]; then
            log "INFO" "Using release build for Vibe Backend"
            PORT=$port ./target/release/vibe-kanban > "$log_file" 2>&1 &
        else
            log "INFO" "Building and starting Vibe Backend (this may take a while)..."
            PORT=$port cargo run --release > "$log_file" 2>&1 &
        fi
    else
        # Normal command execution
        eval "$command > \"$log_file\" 2>&1 &"
    fi
    
    local pid=$!
    echo $pid > "$pid_file"
    
    # Give it a moment to fail fast
    sleep 2
    
    # Check if process is still running
    if ! kill -0 $pid 2>/dev/null; then
        log "ERROR" "$name failed to start. Check $log_file for details"
        tail -n 20 "$log_file"
        return 1
    fi
    
    # Wait for service to be ready
    if wait_for_service "$name" "$port" "$health_url"; then
        log "SUCCESS" "$name started successfully (PID: $pid)"
        return 0
    else
        log "ERROR" "$name failed to become ready"
        kill -9 $pid 2>/dev/null || true
        return 1
    fi
}

# Main startup sequence
main() {
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}     Claude Code UI - Improved Startup Script      ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
    
    # Clean up any existing processes
    cleanup
    
    # Start Claude Backend
    if ! start_service "claude-backend" \
        "cd '$SCRIPT_DIR' && PORT=8080 node server/index.js" \
        8080 \
        "http://localhost:8080/api/config"; then
        log "ERROR" "Failed to start Claude Backend"
        exit 1
    fi
    
    # Start Vibe Backend
    if ! start_service "vibe-backend" \
        "cd '$SCRIPT_DIR/vibe-kanban/backend' && PORT=8081 cargo run --release" \
        8081 \
        "http://localhost:8081/api/health"; then
        log "ERROR" "Failed to start Vibe Backend"
        # Continue anyway, frontend can work without it
    fi
    
    # Start Frontend
    if ! start_service "frontend" \
        "cd '$SCRIPT_DIR' && npx vite --host --port 9000" \
        9000 \
        ""; then
        log "ERROR" "Failed to start Frontend"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}            All services started!                  ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo "📍 Access points:"
    echo "   • Frontend: http://localhost:9000"
    echo "   • Claude API: http://localhost:8080/api"
    echo "   • Vibe API: http://localhost:8081/api"
    echo ""
    echo "📊 Service Status:"
    echo -e "   • Claude Backend: ${GREEN}✓ Running${NC} (port 8080)"
    echo -e "   • Vibe Backend: ${GREEN}✓ Running${NC} (port 8081)"
    echo -e "   • Frontend: ${GREEN}✓ Running${NC} (port 9000)"
    echo ""
    echo "📝 Logs:"
    echo "   • Startup: $LOG_DIR/startup.log"
    echo "   • Claude: $LOG_DIR/claude-backend.log"
    echo "   • Vibe: $LOG_DIR/vibe-backend.log"
    echo "   • Frontend: $LOG_DIR/frontend.log"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Monitor logs for errors
    tail -f "$LOG_DIR"/*.log | grep -E "ERROR|WARN|error|Error" --color=always &
    
    # Wait forever
    wait
}

# Run main function
main