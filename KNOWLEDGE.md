# KNOWLEDGE.md - Mission Control

## Application Purpose and Business Context

Mission Control is a multi-agent orchestration dashboard for Paramount Lead Solutions. It serves as the central hub for task management, AI-assisted planning, and agent coordination across the organization's AI agent workforce.

**Business Value:**
- Centralized task management with Kanban-style interface
- Interactive AI planning before task dispatch
- Multi-agent coordination (Dev Manager, Marketing Manager, Insights Manager)
- Real-time progress tracking
- Multi-machine agent support (remote agents can connect via API)

**Role:** Master controller for Skippy's agent ecosystem - creates tasks, coordinates planning, dispatches work, monitors progress.

---

## Key Features and Capabilities

### Core Features

1. **Task Management**
   - Kanban board with drag-and-drop
   - Task creation, editing, deletion
   - Status tracking (pending, planning, assigned, in_progress, review, completed)
   - Priority levels (low, normal, high)

2. **AI Planning**
   - Interactive Q&A before task dispatch
   - Planning sessions with clarifying questions
   - Agent-specific planning stages
   - Batch question presentation

3. **Agent System**
   - Agent registration and management
   - Task assignment to specific agents
   - Progress reporting
   - Activity logging

4. **Multi-Machine Support**
   - Remote agents connect via API
   - WebSocket connection to OpenClaw Gateway
   - PostgreSQL sync for cross-machine state

### Integration Features

- **OpenClaw Gateway:** WebSocket connection for real-time communication
- **PostgreSQL:** Shared database for agent messaging and task sync
- **SQLite:** Local task queue for the dashboard

---

## Architecture Overview

### Technology Stack

**Frontend:**
- Next.js 14+ (App Router)
- React
- TypeScript
- Tailwind CSS

**Backend:**
- Next.js API Routes
- SQLite (local task queue)
- PostgreSQL (Neon Cloud) for multi-machine sync

**Infrastructure:**
- OpenClaw Gateway integration
- Bearer token authentication
- HMAC webhooks for security

### Directory Structure

```
mission-control/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── tasks/         # Task CRUD
│   │   │   ├── agents/        # Agent management
│   │   │   ├── clarifications/ # Planning Q&A
│   │   │   ├── agent/         # Agent-specific APIs
│   │   │   └── sync/          # Sync status
│   │   └── page.tsx           # Main dashboard
│   ├── lib/
│   │   └── db/
│   │       └── sync-service.ts # SQLite → PostgreSQL sync
│   └── components/            # React components
├── agent-resources/           # Agent configuration files
│   ├── scripts/              # Polling scripts
│   ├── configs/              # Agent env templates
│   └── docs/                 # Setup guides
├── migrations/               # Database migrations
└── instrumentation.ts        # Server startup hooks
```

### Database Schema

**SQLite (Local):**
- Tasks, agents, activities stored locally for dashboard

**PostgreSQL (Neon) - Synced:**
- `mc_tasks` - Task sync table
- `mc_agents` - Agent sync table
- `clarification_queue` - Routing questions to Skippy
- `task_activities` - Activity log sync
- `agent_messages` - Inter-agent messaging (existing)

### Architecture Diagram

```
Skippy's Machine (Master Controller)
    │
    ├── Mission Control (Port 4000)
    │       │
    │       ├── SQLite (local queue)
    │       │
    │       └── Sync Service → PostgreSQL (Neon)
    │
    └── OpenClaw Gateway (Port 18789)
            │
            └── WebSocket ← Remote Agents (Dev, Insights, Marketing)

Remote agents poll PostgreSQL for tasks and report progress via API.
```

---

## How the Application is Used

### Primary Users

1. **Skippy (Master Agent)**
   - Creates and manages tasks
   - Participates in planning sessions
   - Dispatches tasks to agents
   - Monitors overall progress

2. **Dev Manager Agent**
   - Polls for assigned tasks
   - Reports progress via API
   - Creates new tasks for subagents

3. **Marketing Manager Agent**
   - Polls for marketing tasks
   - Reports progress via API

4. **Insights Manager Agent**
   - Polls for analytics tasks
   - Reports progress via API

### Typical Workflow

1. Skippy creates a task in Mission Control dashboard
2. Task enters "planning" stage - clarifying questions asked
3. Planning complete - task marked "ready for dispatch"
4. Task assigned to specific agent (Dev Manager, etc.)
5. Agent polls API, picks up task
6. Agent updates status through workflow
7. Task moves to "review" when agent completes
8. Skippy reviews and marks "completed"

---

## Integrations with Other Systems

### OpenClaw Gateway

- WebSocket connection for real-time events
- Bearer token authentication
- Receives webhooks from agents

### PostgreSQL (Neon)

- Shared state across machines
- Agent messaging queue
- Task sync between dashboard and agents

### Agent Machines

Each agent has:
- Polling script (`agent-poll-mission-control.sh`)
- Config file (`agent-config.env`)
- API token for authentication

---

## API Endpoints

### Tasks

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tasks` | GET | List all tasks |
| `/api/tasks` | POST | Create a task |
| `/api/tasks/{id}` | GET | Get task details |
| `/api/tasks/{id}` | PATCH | Update task |
| `/api/tasks/{id}` | DELETE | Delete task |

### Planning

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tasks/{id}/planning` | POST | Start planning session |
| `/api/tasks/{id}/planning` | GET | Get planning state |
| `/api/tasks/{id}/planning/answer` | POST | Submit answer |
| `/api/tasks/{id}/planning/poll` | GET | Poll for updates |

### Agents

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agents` | GET | List all agents |
| `/api/agents/register` | POST | Register agent |
| `/api/agents/{id}/tasks` | GET | Get agent's tasks |
| `/api/agents/{id}/tasks` | POST | Claim/update/complete task |

### Agent-Specific (for remote agents)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/agent/view-tasks` | GET | View tasks with filters |
| `/api/agent/report-progress` | POST | Update task status |
| `/api/agent/create-task` | POST | Create new task |

### Sync & Health

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sync/status` | GET | Check sync health |
| `/api/clarifications` | GET/POST | Clarification queue |

---

## Environment Variables

```
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
POSTGRES_URL=postgresql://...
MC_API_TOKEN=your-api-token
```

---

## Agent Configuration

Agents use the following setup:

**Config File (`agent-config.env`):**
```
AGENT_ID=dev-manager
AGENT_NAME=Dev Manager
MISSION_CONTROL_API=https://your-ngrok.ngrok.dev
MC_API_TOKEN=your-token
```

**Polling Script:**
- Runs every 30 seconds via LaunchAgent (macOS) or cron
- Calls `/api/agents/{id}/tasks` to check for assigned tasks
- Updates task status via `/api/agents/{id}/tasks`

---

## Status & Deployment

**Current Status:** Phases 1-5 complete, ready for testing

**Implementation Phases:**
- ✅ Phase 1: Database tables
- ✅ Phase 2: Sync service
- ✅ Phase 3: Clarification APIs
- ✅ Phase 4: Agent APIs
- ✅ Phase 5: Monitoring
- ⏳ Phase 6: Multi-machine dispatch
- ⏳ Phase 7: Deploy agent skills

**Local Development:**
```bash
npm install
cp .env.example .env.local
npm run dev
# Open http://localhost:4000
```

---

## Related Repositories

- **skippy-agents-shared** - Shared files and assets for Skippy agents
- **agent-skills** - Custom OpenClaw agent skills

---

*Document created: February 2026*
*Dev Manager Knowledge Base v1.0*
