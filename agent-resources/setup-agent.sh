#!/bin/bash
#
# Quick Setup Script for Mission Control Agents
# 
# Usage: ./setup-agent.sh <agent-name>
#
# This script:
# 1. Creates the config directory
# 2. Copies the appropriate config file
# 3. Prompts for required values
# 4. Installs the LaunchAgent (macOS only)
#

set -e

AGENT_NAME="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.mission-control"

if [[ -z "$AGENT_NAME" ]]; then
    echo "Usage: $0 <agent-name>"
    echo ""
    echo "Available agent configs:"
    ls -1 "$SCRIPT_DIR/configs" | grep '\.env$' | sed 's/\.env$//'
    exit 1
fi

CONFIG_FILE="$SCRIPT_DIR/configs/${AGENT_NAME}.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "Error: No config file found for agent '$AGENT_NAME'"
    echo "Available configs:"
    ls -1 "$SCRIPT_DIR/configs" | grep '\.env$'
    exit 1
fi

echo "=== Mission Control Agent Setup ==="
echo "Agent: $AGENT_NAME"
echo ""

# Create config directory
mkdir -p "$CONFIG_DIR"

# Copy config file
TARGET_CONFIG="$CONFIG_DIR/${AGENT_NAME}.env"
cp "$CONFIG_FILE" "$TARGET_CONFIG"
echo "Created config: $TARGET_CONFIG"

# Prompt for required values
echo ""
echo "Please provide the following values:"
echo ""

read -p "PostgreSQL URL: " PG_URL
read -p "OpenClaw Host (e.g., 192.168.1.152:18789): " OC_HOST
read -p "Machine Hostname [$(hostname -s)]: " MH
MACHINE_HOSTNAME="${MH:-$(hostname -s)}"

# Update config file
if [[ -n "$PG_URL" ]]; then
    sed -i.bak "s|your-postgresql-url-here|$PG_URL|g" "$TARGET_CONFIG"
fi

if [[ -n "$OC_HOST" ]]; then
    sed -i.bak "s|your-openclaw-host:18789|$OC_HOST|g" "$TARGET_CONFIG"
fi

sed -i.bak "s|\$(hostname -s)|$MACHINE_HOSTNAME|g" "$TARGET_CONFIG"

# Remove backup
rm -f "${TARGET_CONFIG}.bak"

echo ""
echo "Configuration saved to: $TARGET_CONFIG"
echo ""

# Test registration
echo "Testing registration..."
source "$TARGET_CONFIG"

RESPONSE=$(curl -s -X POST "${MISSION_CONTROL_URL}/api/agents/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"$AGENT_NAME\",
        \"role\": \"${ROLE:-$AGENT_NAME}\",
        \"webhook_url\": \"${WEBHOOK_URL:-}\",
        \"machine_hostname\": \"$MACHINE_HOSTNAME\",
        \"openclaw_host\": \"${OPENCLAW_HOST:-}\",
        \"capabilities\": ${CAPABILITIES:-[]},
        \"avatar_emoji\": \"${EMOJI:-🤖}\"
    }" 2>/dev/null)

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo "✅ Registration successful!"
    AGENT_ID=$(echo "$RESPONSE" | jq -r '.agent_id')
    echo "Agent ID: $AGENT_ID"
else
    echo "⚠️  Registration test failed. Check the Mission Control URL."
    echo "Response: $RESPONSE"
fi

# Offer to install LaunchAgent on macOS
if [[ "$(uname)" == "Darwin" ]]; then
    echo ""
    read -p "Install as LaunchAgent? [y/N]: " INSTALL_LA
    if [[ "$INSTALL_LA" =~ ^[Yy]$ ]]; then
        PLIST_FILE="$HOME/Library/LaunchAgents/com.mission-control.${AGENT_NAME}-poll.plist"
        SCRIPT_PATH="$SCRIPT_DIR/scripts/agent-poll-mission-control.sh"
        
        sed "s|AGENT_NAME|$AGENT_NAME|g; s|/path/to|$SCRIPT_PATH|g; s|USERNAME|$USER|g" \
            "$SCRIPT_DIR/configs/agent-poll.plist.template" > "$PLIST_FILE"
        
        launchctl load "$PLIST_FILE"
        echo "✅ LaunchAgent installed and started!"
        echo "Logs: /tmp/mission-control-${AGENT_NAME}.log"
    fi
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the agent manually:"
echo "  $SCRIPT_DIR/scripts/agent-poll-mission-control.sh $AGENT_NAME $TARGET_CONFIG"
echo ""
echo "To view logs:"
echo "  tail -f /tmp/mission-control-${AGENT_NAME}.log"
