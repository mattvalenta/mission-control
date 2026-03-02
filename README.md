# Mission Control

**Distributed Task Orchestration for OpenClaw Agents**

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/mattvalenta/mission-control)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue)](https://neon.tech)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Overview

Mission Control is a distributed task orchestration system that coordinates work across multiple OpenClaw agents. It provides:

- **Task Management**: Create, assign, and track tasks across agents
- **Agent Orchestration**: Dispatch tasks to agents based on skills and availability
- **Real-Time Sync**: LISTEN/NOTIFY for instant cross-instance synchronization
- **Job Scheduling**: Distributed job queue with advisory locks
- **Quality Gates**: Approval workflow for critical tasks
- **Audit Logging**: Complete action trail for compliance
- **Webhooks**: Outbound integration with external systems

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL (Neon)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Shared State: tasks, agents, jobs, audit, webhooks    │  │
│  │ LISTEN/NOTIFY for real-time sync                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Skippy Mini    │  │ Dev Manager Mini│  │ Marketing Mini  │
│  (Master)       │  │ (Worker)        │  │ (Worker)        │
│                 │  │                 │  │                 │
│ MC Instance     │  │ MC Instance     │  │ MC Instance     │
│ OpenClaw Gateway│  │ OpenClaw Gateway│  │ OpenClaw Gateway│
│ Local Dashboard │  │ Local Dashboard │  │ Local Dashboard │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- PM2 (`npm install -g pm2`)
- OpenClaw (`npm install -g openclaw`)
- PostgreSQL database (Neon recommended)

### Installation

```bash
# Clone repository
git clone https://github.com/mattvalenta/mission-control.git
cd mission-control

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Build
pnpm build

# Start with PM2
pm2 start npm --name "mission-control" -- start
pm2 save
```

### Verify

```bash
# Health check
curl http://localhost:4000/api/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Key Features

### Phase 1: PostgreSQL Migration ✅

Migrated from SQLite to PostgreSQL for multi-instance support.

- 25 tables
- Connection pooling
- Parameterized queries

### Phase 2: Real-Time Sync ✅

LISTEN/NOTIFY for instant cross-instance synchronization.

- 5 notification channels
- SSE for frontend
- Hybrid polling fallback

### Phase 3: Token Usage Tracking ✅

Comprehensive LLM API token tracking and cost calculation.

- 30+ model pricing
- Per-agent breakdown
- Daily usage stats

### Phase 4: Quality Review Gates ✅

Formal approval workflow with multi-step reviews.

- Single/double review
- Master agent approval
- Automatic step creation

### Phase 5: Job Queue + DLQ ✅

Distributed job scheduling with dead letter queue.

- Advisory locks
- Retry with backoff
- Circuit breaker

### Phase 6: Audit Logging ✅

Comprehensive audit trail for security and compliance.

- All CRUD operations
- Security events
- 90-day retention

### Phase 7: Outbound Webhooks ✅

External system integration via webhooks.

- HMAC signatures
- Retry logic
- Delivery tracking

### Phase 8: Deploy to All Agents ✅

Distributed deployment across agent machines.

- Instance heartbeats
- Health monitoring
- Deployment scripts

### Phase 9: Testing & Polish 🔄

Comprehensive testing and documentation.

- E2E tests
- Load tests
- Runbooks

## API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Basic health check |
| `/api/health/detailed` | GET | Detailed system status |
| `/api/tasks` | GET, POST | List/create tasks |
| `/api/tasks/[id]` | GET, PATCH, DELETE | Task operations |
| `/api/tasks/[id]/dispatch` | POST | Dispatch task to agent |
| `/api/agents` | GET | List agents |
| `/api/agents/[id]` | GET, PATCH | Agent operations |
| `/api/scheduler` | GET, POST | Job management |
| `/api/tokens` | GET, POST | Token usage |
| `/api/audit` | GET | Audit logs |
| `/api/webhooks` | GET, POST | Webhook management |

### Health Check

```bash
curl http://localhost:4000/api/health/detailed
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2026-03-02T12:00:00.000Z",
  "instance": {
    "id": "dev-manager-mini",
    "role": "worker",
    "uptime": 3600
  },
  "database": "connected",
  "instances": {
    "total": 4,
    "online": 4
  },
  "scheduler": {
    "total": 8,
    "running": 5
  }
}
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MC_INSTANCE_ID` | Yes | Unique instance identifier |
| `MC_INSTANCE_ROLE` | Yes | `master` or `worker` |
| `MC_AGENT_NAME` | Yes | Display name for instance |
| `POSTGRES_URL` | Yes | PostgreSQL connection string |
| `OPENCLAW_GATEWAY_HOST` | No | Gateway host (default: 127.0.0.1) |
| `OPENCLAW_GATEWAY_PORT` | No | Gateway port (default: 18789) |
| `DISCORD_CHANNEL_ID` | No | Discord channel for notifications |

## Monitoring

### Scheduled Jobs

| Job | Interval | Purpose |
|-----|----------|---------|
| `instance-heartbeat` | 30s | Report instance online |
| `mark-offline-instances` | 60s | Detect offline instances |
| `cleanup-stale-sessions` | 1h | Clean inactive sessions |
| `check-agent-heartbeats` | 30m | Update agent status |
| `cleanup-old-audit-logs` | 7d | Remove old logs |
| `aggregate-token-usage` | 1h | Daily stats |
| `process-webhook-deliveries` | 60s | Send pending webhooks |

### Alert Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| Instance offline | 5 min | Notify team |
| High error rate | 1% | Log and investigate |
| DLQ item added | Immediate | Notify team |
| Token usage | $100/day | Review |

## Documentation

- [Agent Configurations](docs/agent-configs.md) - Instance setup
- [Deployment Guide](runbooks/deployment.md) - Deploy procedures
- [Rollback Guide](runbooks/rollback.md) - Rollback procedures
- [Incident Response](runbooks/incident-response.md) - Handle incidents
- [Maintenance Guide](runbooks/maintenance.md) - Regular tasks

## Development

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

## License

MIT

---

**Version:** 1.0.0
**Last Updated:** March 2, 2026
