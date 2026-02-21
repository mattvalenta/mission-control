#!/bin/bash
#
# Mission Control Auto-Recovery Script
# 
# This script monitors Mission Control and automatically recovers it if it goes down.
# Should run via cron every 5 minutes.
#
# Usage: ./mc-health-monitor.sh [--recover]
#   --recover: Attempt recovery if unhealthy (default behavior)
#   --check: Only check health, don't recover

set -e

# Configuration
MC_PORT=4000
MC_DIR="/Users/matt/clawd/mission-control"
NGROK_PATH="/tmp/ngrok"
NGROK_AUTH="2tKg6ra7pKpNieY0mNaoNc61Iko_7uJMAJkkGxvDy23QTumBA"
PUBLIC_URL="https://loculicidally-unfluttering-clemmie.ngrok-free.dev"
LOG_FILE="/tmp/mc-recovery.log"
MAX_RESTART_ATTEMPTS=3
RESTART_COOLDOWN=60  # seconds between restart attempts

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if Mission Control is running on localhost
check_mc_local() {
    if curl -s --max-time 5 "http://localhost:$MC_PORT" > /dev/null 2>&1; then
        return 0  # Healthy
    else
        return 1  # Unhealthy
    fi
}

# Check if ngrok tunnel is active
check_ngrok() {
    if curl -s --max-time 5 "http://127.0.0.1:4040/api/tunnels" 2>/dev/null | grep -q "public_url"; then
        return 0  # Running
    else
        return 1  # Not running
    fi
}

# Check public endpoint (ngrok tunnel working)
check_public() {
    if curl -s --max-time 10 "$PUBLIC_URL" > /dev/null 2>&1; then
        return 0  # Accessible
    else
        return 1  # Not accessible
    fi
}

# Start Mission Control
start_mc() {
    log "${YELLOW}Starting Mission Control...${NC}"
    
    cd "$MC_DIR"
    
    # Kill any existing Next.js processes on this port
    pkill -f "next dev.*$MC_PORT" 2>/dev/null || true
    sleep 2
    
    # Start Mission Control in background
    nohup npm run dev -- -p $MC_PORT >> "$LOG_FILE" 2>&1 &
    
    # Wait for startup
    sleep 5
    
    # Verify it started
    if check_mc_local; then
        log "${GREEN}Mission Control started successfully on port $MC_PORT${NC}"
        return 0
    else
        log "${RED}Failed to start Mission Control${NC}"
        return 1
    fi
}

# Start ngrok tunnel
start_ngrok() {
    log "${YELLOW}Starting ngrok tunnel...${NC}"
    
    # Kill existing ngrok
    pkill -f "ngrok http" 2>/dev/null || true
    sleep 2
    
    # Start ngrok
    "$NGROK_PATH" http $MC_PORT --authtoken="$NGROK_AUTH" > /dev/null 2>&1 &
    
    # Wait for ngrok to start
    sleep 3
    
    # Verify ngrok is running
    if check_ngrok; then
        log "${GREEN}ngrok tunnel started successfully${NC}"
        return 0
    else
        log "${RED}Failed to start ngrok tunnel${NC}"
        return 1
    fi
}

# Full recovery procedure
recover() {
    log "=========================================="
    log "${YELLOW}STARTING RECOVERY PROCEDURE${NC}"
    log "=========================================="
    
    local attempts=0
    local mc_ok=false
    local ngrok_ok=false
    
    # Step 1: Check/recover Mission Control
    if ! check_mc_local; then
        log "${RED}Mission Control is DOWN${NC}"
        
        while [ $attempts -lt $MAX_RESTART_ATTEMPTS ]; do
            attempts=$((attempts + 1))
            log "Attempt $attempts/$MAX_RESTART_ATTEMPTS to restart Mission Control..."
            
            if start_mc; then
                mc_ok=true
                break
            fi
            
            sleep $RESTART_COOLDOWN
        done
        
        if [ "$mc_ok" = false ]; then
            log "${RED}CRITICAL: Could not recover Mission Control after $MAX_RESTART_ATTEMPTS attempts${NC}"
            # Send alert
            send_alert "Mission Control Recovery Failed" "Could not start Mission Control after $MAX_RESTART_ATTEMPTS attempts. Manual intervention required."
            return 1
        fi
    else
        log "${GREEN}Mission Control is running${NC}"
        mc_ok=true
    fi
    
    # Step 2: Check/recover ngrok
    if ! check_ngrok || ! check_public; then
        log "${RED}ngrok tunnel is DOWN${NC}"
        
        if start_ngrok; then
            ngrok_ok=true
        else
            log "${RED}Failed to start ngrok tunnel${NC}"
            send_alert "ngrok Recovery Failed" "Could not start ngrok tunnel. Mission Control is running locally but not publicly accessible."
            return 1
        fi
    else
        log "${GREEN}ngrok tunnel is running${NC}"
        ngrok_ok=true
    fi
    
    # Step 3: Verify public access
    sleep 3
    if check_public; then
        log "${GREEN}Public endpoint is accessible${NC}"
        log "=========================================="
        log "${GREEN}RECOVERY SUCCESSFUL${NC}"
        log "=========================================="
        send_alert "Mission Control Recovered" "Mission Control and ngrok tunnel have been automatically recovered and are now running."
        return 0
    else
        log "${YELLOW}Mission Control is running locally but public endpoint may need time to propagate${NC}"
        return 0
    fi
}

# Send alert (can be extended to Discord, email, etc.)
send_alert() {
    local title="$1"
    local message="$2"
    
    log "${YELLOW}ALERT: $title${NC}"
    log "$message"
    
    # Discord notification via OpenClaw gateway
    curl -s -X POST "http://127.0.0.1:18789/api/message" \
        -H "Content-Type: application/json" \
        -d "{
            \"action\": \"send\",
            \"channel\": \"discord\",
            \"to\": \"-1003890400146:topic:26\",
            \"message\": \"🚨 **$title**\\n\\n$message\"
        }" 2>/dev/null || true
    
    # Also log it
    echo "ALERT: $title - $message" >> "$LOG_FILE"
}

# Health check only (no recovery)
health_check() {
    echo "Mission Control Health Check - $(date)"
    echo "========================================"
    
    if check_mc_local; then
        echo "✅ Mission Control (localhost:$MC_PORT): RUNNING"
    else
        echo "❌ Mission Control (localhost:$MC_PORT): DOWN"
    fi
    
    if check_ngrok; then
        echo "✅ ngrok tunnel: RUNNING"
    else
        echo "❌ ngrok tunnel: DOWN"
    fi
    
    if check_public; then
        echo "✅ Public endpoint ($PUBLIC_URL): ACCESSIBLE"
    else
        echo "❌ Public endpoint ($PUBLIC_URL): NOT ACCESSIBLE"
    fi
    
    echo "========================================"
}

# Main
main() {
    local mode="${1:---recover}"
    
    case "$mode" in
        --check)
            health_check
            ;;
        --recover)
            if ! check_mc_local || ! check_ngrok || ! check_public; then
                recover
            else
                log "${GREEN}All systems healthy${NC}"
            fi
            ;;
        *)
            echo "Usage: $0 [--recover|--check]"
            exit 1
            ;;
    esac
}

main "$@"
