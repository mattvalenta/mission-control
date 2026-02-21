#!/bin/bash
#
# Quick Start Script for Mission Control
# Starts both MC and ngrok in one command
#

set -e

MC_DIR="/Users/matt/clawd/mission-control"
NGROK_PATH="/tmp/ngrok"
NGROK_AUTH="2tKg6ra7pKpNieY0mNaoNc61Iko_7uJMAJkkGxvDy23QTumBA"

echo "🚀 Starting Mission Control..."

# Start Mission Control
cd "$MC_DIR"
pkill -f "next dev.*4000" 2>/dev/null || true
sleep 1

echo "  → Starting Next.js server on port 4000..."
nohup npm run dev -- -p 4000 > /tmp/mc-server.log 2>&1 &
sleep 3

# Start ngrok
echo "  → Starting ngrok tunnel..."
pkill -f "ngrok http" 2>/dev/null || true
sleep 1
"$NGROK_PATH" http 4000 --authtoken="$NGROK_AUTH" > /dev/null 2>&1 &
sleep 3

# Verify
echo ""
echo "Checking status..."

if curl -s http://localhost:4000 > /dev/null 2>&1; then
    echo "  ✅ Mission Control: RUNNING on http://localhost:4000"
else
    echo "  ❌ Mission Control: FAILED"
fi

TUNNEL_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print([t['public_url'] for t in d.get('tunnels',[])][0] if d.get('tunnels') else '')" 2>/dev/null || echo "")

if [ -n "$TUNNEL_URL" ]; then
    echo "  ✅ ngrok tunnel: $TUNNEL_URL"
else
    echo "  ❌ ngrok tunnel: FAILED"
fi

echo ""
echo "🌐 Public URL: https://loculicidally-unfluttering-clemmie.ngrok-free.dev"
echo ""
echo "Logs:"
echo "  MC Server: /tmp/mc-server.log"
echo "  Recovery:  /tmp/mc-recovery.log"
