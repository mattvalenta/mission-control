# Agent Instance Configurations

**Last Updated:** March 2, 2026

---

## Instance Registry

| Agent | Instance ID | Role | Machine | Status |
|-------|-------------|------|---------|--------|
| Skippy | `skippy-mac-mini` | master | Mac Mini #1 (192.168.1.152) | Active |
| Dev Manager | `dev-manager-mini` | worker | Mac Mini #2 (192.168.1.153) | Active |
| Marketing Manager | `marketing-mini` | worker | Mac Mini #3 (TBD) | Pending |
| Insights Manager | `insights-mini` | worker | Mac Mini #4 (TBD) | Pending |

---

## Instance Roles

### Master (Skippy)
- Can approve quality reviews for `done` status
- Receives escalated decisions
- Primary notification receiver
- Circuit breaker override authority

### Worker (All Others)
- Can claim jobs from queue
- Can submit quality reviews
- Standard dispatch permissions
- Local dashboard access

---

## Environment Variables

### Required for All Instances
```bash
# Instance Identity
MC_INSTANCE_ID=<unique-id>
MC_INSTANCE_ROLE=<master|worker>
MC_AGENT_NAME=<Agent Name>

# PostgreSQL Connection (Shared)
POSTGRES_URL=postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw?sslmode=require

# OpenClaw Gateway (Local)
OPENCLAW_GATEWAY_HOST=127.0.0.1
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_HOME=/Users/<user>/.openclaw

# Discord
DISCORD_CHANNEL_ID=1473425570422460449
```

### Master-Only
```bash
MC_MASTER_KEY=<secret-key>
NOTIFICATION_EMAIL=<email>
```

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL (Neon)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Shared State: tasks, agents, jobs, audit, webhooks   │  │
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
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    Discord #dev-manager
                    (Inter-agent comms)
```

---

## Deployment Checklist

### Per-Agent Setup

1. **Prerequisites**
   - [ ] Node.js 20+ installed
   - [ ] pnpm installed (`npm install -g pnpm`)
   - [ ] Git installed
   - [ ] OpenClaw installed (`npm install -g openclaw`)
   - [ ] PM2 installed (`npm install -g pm2`)

2. **Clone & Install**
   ```bash
   git clone https://github.com/mattvalenta/mission-control.git
   cd mission-control
   pnpm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with instance-specific values
   ```

4. **Build & Start**
   ```bash
   pnpm build
   pm2 start npm --name "mission-control" -- start
   pm2 save
   pm2 startup  # Follow instructions
   ```

5. **Verify**
   - [ ] Dashboard loads at http://localhost:4000
   - [ ] Tasks visible
   - [ ] Agent status shows online
   - [ ] OpenClaw gateway running

---

## Health Monitoring

### Instance Heartbeat
Each instance sends heartbeat every 30 seconds:
```sql
INSERT INTO mc_instances (id, agent_name, role, status, last_heartbeat)
VALUES ($1, $2, $3, 'online', NOW())
ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW(), status = 'online';
```

### Health Check Endpoint
```
GET /api/health/detailed
```

Returns:
- Total instances online
- Each instance's last heartbeat
- Job queue status
- Database connection status

---

## Failure Scenarios

### Instance Goes Offline
1. Heartbeat stops updating
2. Other instances continue normally
3. Jobs assigned to offline instance return to queue after timeout
4. Instance reconnects and syncs on restart

### Network Partition
1. Instances continue with local state
2. Fallback to polling if LISTEN/NOTIFY fails
3. Merge on reconnection

### Database Outage
1. Instances cache locally
2. Alert via Discord
3. Resume when database restored

---

**Document Version:** 1.0
