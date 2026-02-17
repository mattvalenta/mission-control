#!/bin/bash
#
# Mission Control Agent Poller
# 
# This script runs on each agent machine and:
# 1. Registers the agent with Mission Control
# 2. Polls for assigned tasks via API
# 3. Checks PostgreSQL agent_messages for task notifications
# 4. Claims and processes tasks
#
# Usage: ./agent-poll-mission-control.sh <agent-name> [config-file]
#
# Example config file (agent-config.env):
#   MISSION_CONTROL_URL=https://master-controller-tasks.ngrok.dev
#   AGENT_NAME=dev-manager
#   POSTGRES_URL=postgresql://...
#   OPENCLAW_HOST=192.168.1.152:18789
#   WEBHOOK_URL=http://192.168.1.152:18789/hooks/agent

set -e

# Configuration
AGENT_NAME="${1:-dev-manager}"
CONFIG_FILE="${2:-$HOME/.mission-control/$AGENT_NAME.env}"
LOG_FILE="/tmp/mission-control-$AGENT_NAME.log"
POLL_INTERVAL="${POLL_INTERVAL:-30}"

# Default values (can be overridden by config file)
MISSION_CONTROL_URL="${MISSION_CONTROL_URL:-https://master-controller-tasks.ngrok.dev}"
POSTGRES_URL="${POSTGRES_URL:-postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw?sslmode=require&channel_binding=require}"
OPENCLAW_HOST="${OPENCLAW_HOST:-192.168.1.152:18789}"

# Load config if exists
if [[ -f "$CONFIG_FILE" ]]; then
    echo "[$(date)] Loading config from $CONFIG_FILE" >> "$LOG_FILE"
    source "$CONFIG_FILE"
fi

# Ensure we have required values
: ${MISSION_CONTROL_URL:?"MISSION_CONTROL_URL is required"}
: ${AGENT_NAME:?"AGENT_NAME is required"}

# Get machine hostname
MACHINE_HOSTNAME="${MACHINE_HOSTNAME:-$(hostname -s)}"

# PostgreSQL connection helper
pg_query() {
    psql "$POSTGRES_URL" -t -A -c "$1" 2>/dev/null
}

pg_exec() {
    psql "$POSTGRES_URL" -c "$1" 2>/dev/null
}

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$AGENT_NAME] $1" | tee -a "$LOG_FILE"
}

# Register with Mission Control
register_agent() {
    local capabilities="$1"
    local role="$2"
    local emoji="$3"
    
    log "Registering with Mission Control..."
    
    local payload=$(cat <<EOF
{
    "name": "$AGENT_NAME",
    "role": "${role:-$AGENT_NAME}",
    "webhook_url": "${WEBHOOK_URL:-http://${OPENCLAW_HOST}/hooks/agent}",
    "machine_hostname": "$MACHINE_HOSTNAME",
    "openclaw_host": "$OPENCLAW_HOST",
    "poll_interval_ms": $((POLL_INTERVAL * 1000)),
    "capabilities": ${capabilities:-"[]"},
    "avatar_emoji": "${emoji:-🤖}"
}
EOF
)
    
    local response=$(curl -s -X POST "${MISSION_CONTROL_URL}/api/agents/register" \
        -H "Content-Type: application/json" \
        -d "$payload")
    
    local agent_id=$(echo "$response" | jq -r '.agent_id // empty')
    
    if [[ -n "$agent_id" ]]; then
        log "Registered successfully. Agent ID: $agent_id"
        echo "$agent_id" > "/tmp/mission-control-${AGENT_NAME}-id.txt"
        echo "$agent_id"
    else
        log "Registration failed: $response"
        return 1
    fi
}

# Get agent ID (register if needed)
get_agent_id() {
    local id_file="/tmp/mission-control-${AGENT_NAME}-id.txt"
    
    if [[ -f "$id_file" ]]; then
        cat "$id_file"
        return 0
    fi
    
    # Need to register
    register_agent
}

# Poll Mission Control for tasks
poll_tasks() {
    local agent_id="$1"
    
    log "Polling for tasks..."
    
    local response=$(curl -s "${MISSION_CONTROL_URL}/api/agents/${agent_id}/tasks")
    
    if [[ -z "$response" ]]; then
        log "No response from Mission Control"
        return 1
    fi
    
    local count=$(echo "$response" | jq -r '.count // 0')
    
    if [[ "$count" -gt 0 ]]; then
        log "Found $count pending task(s)"
        echo "$response" | jq -r '.tasks'
    else
        log "No pending tasks"
    fi
}

# Check PostgreSQL agent_messages for task notifications
check_agent_messages() {
    log "Checking agent_messages for notifications..."
    
    local messages=$(pg_query "
        SELECT id, from_agent, content, task_id, created_at 
        FROM agent_messages 
        WHERE to_agent='$AGENT_NAME' 
        AND status IN ('pending', 'received')
        ORDER BY created_at
        LIMIT 5
    ")
    
    if [[ -n "$messages" ]]; then
        log "Found agent messages"
        
        # Mark as received
        pg_exec "
            UPDATE agent_messages 
            SET status='received', received_at=NOW() 
            WHERE to_agent='$AGENT_NAME' AND status='pending'
        " >> "$LOG_FILE" 2>&1
        
        echo "$messages"
    fi
}

# Claim a task
claim_task() {
    local agent_id="$1"
    local task_id="$2"
    
    log "Claiming task: $task_id"
    
    local response=$(curl -s -X POST "${MISSION_CONTROL_URL}/api/agents/${agent_id}/tasks" \
        -H "Content-Type: application/json" \
        -d "{\"action\":\"claim\",\"task_id\":\"$task_id\",\"message\":\"Agent $AGENT_NAME claiming task\"}")
    
    if echo "$response" | jq -e '.success' > /dev/null 2>&1; then
        log "Task claimed successfully"
        return 0
    else
        log "Failed to claim task: $response"
        return 1
    fi
}

# Update task progress
update_task() {
    local agent_id="$1"
    local task_id="$2"
    local status="$3"
    local message="$4"
    
    log "Updating task $task_id: $status - $message"
    
    curl -s -X POST "${MISSION_CONTROL_URL}/api/agents/${agent_id}/tasks" \
        -H "Content-Type: application/json" \
        -d "{\"action\":\"update\",\"task_id\":\"$task_id\",\"status\":\"$status\",\"message\":\"$message\"}" > /dev/null
}

# Complete a task
complete_task() {
    local agent_id="$1"
    local task_id="$2"
    local message="$3"
    
    log "Completing task: $task_id"
    
    curl -s -X POST "${MISSION_CONTROL_URL}/api/agents/${agent_id}/tasks" \
        -H "Content-Type: application/json" \
        -d "{\"action\":\"complete\",\"task_id\":\"$task_id\",\"message\":\"$message\"}" > /dev/null
}

# Send message to another agent via PostgreSQL
send_agent_message() {
    local to_agent="$1"
    local content="$2"
    local task_id="${3:-}"
    
    log "Sending message to $to_agent"
    
    local task_id_sql="${task_id:+, '$task_id'}"
    
    pg_exec "
        INSERT INTO agent_messages (from_agent, to_agent, content, status, task_id)
        VALUES ('$AGENT_NAME', '$to_agent', '$content', 'pending'${task_id_sql:+, '$task_id'})
    " >> "$LOG_FILE" 2>&1
}

# Wake the agent via OpenClaw webhook
wake_agent() {
    local target_agent="$1"
    local message="${2:-Task notification from $AGENT_NAME}"
    
    log "Waking agent: $target_agent"
    
    # Send message to database
    send_agent_message "$target_agent" "$message"
    
    # Trigger webhook wake
    curl -s -X POST "http://${OPENCLAW_HOST}/hooks/wake" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"$message\",\"mode\":\"now\"}" > /dev/null 2>&1 || true
}

# Process a task (override this function in agent-specific scripts)
process_task() {
    local task_id="$1"
    local task_data="$2"
    
    log "Processing task: $task_id"
    
    # Extract task info
    local title=$(echo "$task_data" | jq -r '.title')
    local description=$(echo "$task_data" | jq -r '.description')
    local spec=$(echo "$task_data" | jq -r '.planning_spec')
    
    log "Task: $title"
    log "Description: ${description:0:100}..."
    
    # Default: just acknowledge
    # In production, this would dispatch to the actual agent
    log "Task processing not implemented - override process_task() in agent script"
    
    return 0
}

# Main poll loop
main() {
    log "Starting Mission Control Agent Poller"
    log "Agent: $AGENT_NAME"
    log "Mission Control: $MISSION_CONTROL_URL"
    log "Poll interval: ${POLL_INTERVAL}s"
    
    # Get or register agent ID
    local agent_id=$(get_agent_id)
    
    if [[ -z "$agent_id" ]]; then
        log "Failed to get agent ID. Exiting."
        exit 1
    fi
    
    # Main loop
    while true; do
        # 1. Poll Mission Control API for assigned tasks
        local tasks=$(poll_tasks "$agent_id")
        
        if [[ -n "$tasks" && "$tasks" != "null" ]]; then
            # Process each task
            echo "$tasks" | jq -c '.[]' 2>/dev/null | while read -r task; do
                local task_id=$(echo "$task" | jq -r '.id')
                local task_status=$(echo "$task" | jq -r '.status')
                
                log "Found task: $task_id (status: $task_status)"
                
                # Claim if not already in progress
                if [[ "$task_status" != "in_progress" ]]; then
                    if claim_task "$agent_id" "$task_id"; then
                        # Process the task
                        process_task "$task_id" "$task"
                    fi
                fi
            done
        fi
        
        # 2. Check PostgreSQL for agent-to-agent messages
        local messages=$(check_agent_messages)
        
        if [[ -n "$messages" ]]; then
            log "Processing agent messages..."
            # Process messages - could trigger task processing
            while IFS='|' read -r id from content task_id created; do
                log "Message from $from: ${content:0:50}..."
                
                # Mark as completed after processing
                pg_exec "UPDATE agent_messages SET status='completed', completed_at=NOW() WHERE id='$id'" >> "$LOG_FILE" 2>&1
            done <<< "$messages"
        fi
        
        # 3. Update heartbeat
        curl -s "${MISSION_CONTROL_URL}/api/agents/${agent_id}/tasks" > /dev/null 2>&1
        
        # Wait for next poll
        sleep "$POLL_INTERVAL"
    done
}

# Run main
main "$@"
