# Mission Control - Agent Orchestration Dashboard

Create tasks. Plan with AI. Dispatch to agents. Watch them work.

## Quick Start

### Dashboard Setup

```bash
# Clone the repo
git clone https://github.com/mattvalenta/mission-control.git
cd mission-control

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your OpenClaw gateway token

# Run the dashboard
npm run dev
```

Open http://localhost:4000

### Agent Setup

See [agent-resources/docs/AGENT_SETUP.md](agent-resources/docs/AGENT_SETUP.md) for agent configuration.

## Features

- 🎯 **Task Management** — Kanban board with drag-and-drop
- 🧠 **AI Planning** — Interactive Q&A before task dispatch
- 🤖 **Agent System** — Register agents, assign tasks, track progress
- 🔌 **OpenClaw Integration** — WebSocket connection to OpenClaw Gateway
- 📡 **Multi-Machine** — Agents can run anywhere and connect via API
- 🔒 **Security First** — Bearer token auth, HMAC webhooks

## Architecture

```
Mission Control Dashboard (Next.js)
         │
         ├── SQLite (local task queue)
         │
         ├── WebSocket → OpenClaw Gateway
         │
         └── API Endpoints
              │
              └── Agents poll via API + PostgreSQL
```

## Agent Resources

The `agent-resources/` directory contains everything agents need:

```
agent-resources/
├── scripts/
│   └── agent-poll-mission-control.sh   # Main polling script
├── configs/
│   ├── agent-config.template.env        # Config template
│   ├── dev-manager.env                  # Dev agent config
│   ├── marketing-manager.env            # Marketing agent config
│   ├── insights-manager.env             # Insights agent config
│   └── agent-poll.plist.template        # macOS LaunchAgent
├── docs/
│   └── AGENT_SETUP.md                   # Setup guide
└── setup-agent.sh                       # Quick setup script
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_URL` | WebSocket URL to OpenClaw Gateway |
| `OPENCLAW_GATEWAY_TOKEN` | Authentication token |
| `POSTGRES_URL` | PostgreSQL for agent messaging |
| `MC_API_TOKEN` | API auth token (optional) |

## API Endpoints

### Tasks

- `GET /api/tasks` — List all tasks
- `POST /api/tasks` — Create a task
- `GET /api/tasks/{id}` — Get task details
- `PATCH /api/tasks/{id}` — Update task
- `DELETE /api/tasks/{id}` — Delete task

### Planning

- `POST /api/tasks/{id}/planning` — Start planning session
- `GET /api/tasks/{id}/planning` — Get planning state
- `POST /api/tasks/{id}/planning/answer` — Submit answer
- `GET /api/tasks/{id}/planning/poll` — Poll for updates

### Agents

- `GET /api/agents` — List all agents
- `POST /api/agents/register` — Register agent
- `GET /api/agents/{id}/tasks` — Get agent's tasks
- `POST /api/agents/{id}/tasks` — Claim/update/complete task

## Documentation

- [Production Setup](PRODUCTION_SETUP.md)
- [Agent Setup Guide](agent-resources/docs/AGENT_SETUP.md)

## License

MIT
