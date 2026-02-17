# Mission Control Agent Resources

This directory contains everything agents need to connect to and work with Mission Control.

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/mattvalenta/mission-control.git
cd mission-control/agent-resources
```

### 2. Create Configuration

```bash
# Create config directory
mkdir -p ~/.mission-control

# Copy and edit config for your agent
cp configs/AGENT_NAME.env ~/.mission-control/
nano ~/.mission-control/AGENT_NAME.env
```

### 3. Run the Polling Script

```bash
chmod +x scripts/agent-poll-mission-control.sh
./scripts/agent-poll-mission-control.sh dev-manager ~/.mission-control/dev-manager.env
```

### 4. Install as LaunchAgent (macOS)

```bash
# Edit the plist template
sed 's|AGENT_NAME|dev-manager|g; s|/path/to|/path/to/your/scripts|g; s|USERNAME|yourusername|g' \
    configs/agent-poll.plist.template > ~/Library/LaunchAgents/com.mission-control.dev-manager-poll.plist

# Load it
launchctl load ~/Library/LaunchAgents/com.mission-control.dev-manager-poll.plist
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     MISSION CONTROL (Hub)                        │
│              https://master-controller-tasks.ngrok.dev           │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Task Queue  │  │   Agents    │  │  Webhook    │              │
│  │  (SQLite)   │  │  Registry   │  │  Receiver   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
└─────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL (agent_messages)                   │
│              Inter-Agent Communication Bus                       │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
     ┌─────────┐     ┌─────────┐     ┌─────────┐
     │  DEV    │     │MARKETING│     │INSIGHTS │
     │ AGENT   │     │ AGENT   │     │ AGENT   │
     │  🔧     │     │   📱    │     │   📊    │
     └─────────┘     └─────────┘     └─────────┘
```

## Agent Communication

### Two-Way Communication

Agents communicate via two channels:

1. **Mission Control API** - Task assignment, status updates
2. **PostgreSQL agent_messages** - Inter-agent messages

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents/register` | POST | Register agent |
| `/api/agents/{id}/tasks` | GET | Poll for assigned tasks |
| `/api/agents/{id}/tasks` | POST | Claim/update/complete tasks |
| `/api/tasks` | GET/POST | List/create tasks |
| `/api/tasks/{id}` | PATCH | Update task (assign, status) |

### Agent Message Table

```sql
-- Send message to another agent
INSERT INTO agent_messages (from_agent, to_agent, content, status, task_id)
VALUES ('sender', 'recipient', 'message content', 'pending', 'task-uuid');

-- Check for messages
SELECT * FROM agent_messages 
WHERE to_agent = 'your-agent-name' 
AND status = 'pending';

-- Mark as processed
UPDATE agent_messages 
SET status = 'completed', completed_at = NOW() 
WHERE id = 'message-id';
```

## Task Lifecycle

```
CREATED → PLANNING → ASSIGNED → IN_PROGRESS → REVIEW → DONE
                         │            │           │
                         │            │           └── Agent completes
                         │            └── Agent claims
                         └── Assigned to agent
```

## Configuration Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MISSION_CONTROL_URL` | Yes | Mission Control dashboard URL |
| `AGENT_NAME` | Yes | Unique agent identifier |
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `OPENCLAW_HOST` | No | OpenClaw gateway for webhooks |
| `WEBHOOK_URL` | No | URL to receive wake notifications |
| `MACHINE_HOSTNAME` | No | Machine identifier |
| `POLL_INTERVAL` | No | Seconds between polls (default: 30) |
| `CAPABILITIES` | No | JSON array of capabilities |
| `ROLE` | No | Agent role description |
| `EMOJI` | No | Dashboard display emoji |

## Troubleshooting

### Check Logs

```bash
# Agent poller logs
tail -f /tmp/mission-control-{agent-name}.log

# Mission Control server logs
# Check the Next.js console output
```

### Manual Registration Test

```bash
curl -X POST https://master-controller-tasks.ngrok.dev/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-agent",
    "role": "Test Agent",
    "capabilities": ["test"]
  }'
```

### Check PostgreSQL Connection

```bash
psql "$POSTGRES_URL" -c "SELECT * FROM agent_messages WHERE to_agent='your-agent' LIMIT 5;"
```

## File Structure

```
agent-resources/
├── scripts/
│   └── agent-poll-mission-control.sh   # Main polling script
├── configs/
│   ├── agent-config.template.env        # Template for new agents
│   ├── dev-manager.env                  # Dev manager config
│   ├── marketing-manager.env            # Marketing manager config
│   ├── insights-manager.env             # Insights manager config
│   └── agent-poll.plist.template        # macOS LaunchAgent template
└── docs/
    └── AGENT_SETUP.md                   # This file
```
