# Phase 8: Deploy to All Agents

**Duration:** 2 Weeks  
**Priority:** 🔴 Critical  
**Risk Level:** High  
**Dependencies:** All Previous Phases

---

## Objective

Deploy Mission Control to each agent's machine, creating a fully distributed system where every agent has local dashboard access and can participate in job execution.

---

## Success Criteria

- [ ] Each agent runs local MC instance
- [ ] All instances stay synchronized
- [ ] No single point of failure
- [ ] Job queue distributes across instances
- [ ] Agent setup documented

---

## Week 1: Preparation

### Day 1-2: Agent Configuration

#### 1.1 Create Instance Identity
- [ ] Generate unique MC_INSTANCE_ID for each agent
- [ ] Document in `docs/agent-configs.md`

```
| Agent | Instance ID | Role | Machine |
|-------|-------------|------|---------|
| Skippy | skippy-mac-mini | master | 192.168.1.152 |
| Dev Manager | dev-manager-mini | worker | 192.168.1.153 |
| Marketing Manager | marketing-mini | worker | 192.168.1.154 |
| Insights Manager | insights-mini | worker | 192.168.1.155 |
```

#### 1.2 Create Environment Templates
- [ ] Create `env.template` for agent machines
- [ ] Document required variables

```bash
# Mission Control Instance Config
MC_INSTANCE_ID=dev-manager-mini
MC_INSTANCE_ROLE=worker
MC_AGENT_NAME=Dev Manager

# PostgreSQL Connection
POSTGRES_URL=postgresql://user:pass@host:5432/mc_prod

# OpenClaw Gateway
OPENCLAW_GATEWAY_HOST=127.0.0.1
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_HOME=/Users/dev-manager/.openclaw

# Discord
DISCORD_CHANNEL_ID=1473425570422460449
```

#### 1.3 Create Deployment Script
- [ ] Create `scripts/deploy-to-agent.sh`
- [ ] Pull latest code
- [ ] Install dependencies
- [ ] Configure environment
- [ ] Start service

```bash
#!/bin/bash
# scripts/deploy-to-agent.sh

INSTANCE_ID=$1
AGENT_NAME=$2

echo "Deploying Mission Control for $AGENT_NAME..."

# Pull latest
git pull origin main

# Install dependencies
pnpm install --frozen-lockfile

# Build
pnpm build

# Create env file if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "MC_INSTANCE_ID=$INSTANCE_ID" >> .env
  echo "MC_AGENT_NAME=$AGENT_NAME" >> .env
fi

# Start service
pm2 start npm --name "mission-control" -- start
pm2 save
```

### Day 3-4: Gateway Architecture Decision

#### 2.1 Decide Gateway Strategy

**Option A: Local Gateway per Agent**
```
Each agent runs:
- Mission Control (port 4000)
- OpenClaw Gateway (port 18789)
- Agent session

Pros: Full autonomy, no SPOF
Cons: Cross-machine session visibility limited
```

**Option B: Central Gateway**
```
All agents connect to Skippy's gateway

Pros: Unified session view
Cons: SPOF, network dependency
```

**Recommendation: Option A (Hybrid)**
- Each agent has local gateway for session control
- PostgreSQL for cross-machine state
- Discord for inter-agent communication

#### 2.2 Configure Local Gateways
- [ ] Install OpenClaw on each machine
- [ ] Configure gateway port (unique if same machine)
- [ ] Test gateway connectivity

### Day 5: Pre-Deployment Testing

#### 3.1 Test Multi-Instance Locally
- [ ] Run two MC instances locally
- [ ] Test LISTEN/NOTIFY sync
- [ ] Test job queue distribution
- [ ] Test conflict resolution

---

## Week 2: Deployment

### Day 1-2: Deploy to First Agent (Dev Manager)

#### 4.1 Deployment Steps
1. [ ] SSH to agent machine
2. [ ] Clone/pull repository
3. [ ] Install dependencies
4. [ ] Configure environment
5. [ ] Start Mission Control
6. [ ] Start OpenClaw Gateway
7. [ ] Verify connection to PostgreSQL
8. [ ] Verify LISTEN/NOTIFY working

#### 4.2 Validation
- [ ] Dashboard loads
- [ ] Tasks visible
- [ ] Agents visible
- [ ] Can create tasks
- [ ] Can claim jobs
- [ ] Syncs with Skippy's instance

### Day 3-4: Deploy to Remaining Agents

#### 5.1 Marketing Manager
- [ ] Deploy MC
- [ ] Configure instance
- [ ] Validate functionality
- [ ] Test sync with other instances

#### 5.2 Insights Manager
- [ ] Deploy MC
- [ ] Configure instance
- [ ] Validate functionality
- [ ] Test sync with other instances

### Day 5: Integration Testing

#### 6.1 Multi-Instance Tests
- [ ] Create task on Skippy → appears on Dev Manager
- [ ] Update task on Dev Manager → appears on Skippy
- [ ] Job runs on Marketing Manager
- [ ] Agent status syncs across all instances
- [ ] Circuit breaker works across instances

#### 6.2 Failure Tests
- [ ] Kill one instance → others continue
- [ ] Restart instance → reconnects and syncs
- [ ] Network partition → fallback to polling

---

## Agent Setup Checklist

For each agent machine:

### Prerequisites
- [ ] Node.js 20+ installed
- [ ] pnpm installed
- [ ] Git installed
- [ ] OpenClaw installed (`npm install -g openclaw`)
- [ ] PM2 installed (`npm install -g pm2`)

### Installation
```bash
# Clone repository
git clone https://github.com/mattvalenta/mission-control.git
cd mission-control

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env
# Edit .env with instance-specific values

# Build
pnpm build

# Start with PM2
pm2 start npm --name "mission-control" -- start
pm2 save
pm2 startup  # Follow instructions
```

### Verification
- [ ] Dashboard loads at http://localhost:4000
- [ ] Tasks visible
- [ ] Agent status correct
- [ ] OpenClaw gateway running

---

## Monitoring Multi-Instance

### Health Check Script
```typescript
// src/app/api/health/detailed/route.ts
export async function GET() {
  const instances = await queryAll(
    `SELECT * FROM mc_instances WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'`
  );
  
  return NextResponse.json({
    status: 'ok',
    totalInstances: instances.length,
    instances: instances.map(i => ({
      id: i.id,
      agentName: i.agent_name,
      status: i.status,
      lastHeartbeat: i.last_heartbeat
    }))
  });
}
```

### Heartbeat Job
```typescript
handlers['instance-heartbeat'] = async () => {
  await run(
    `INSERT INTO mc_instances (id, agent_name, role, status, last_heartbeat)
     VALUES ($1, $2, $3, 'online', NOW())
     ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW(), status = 'online'`,
    [process.env.MC_INSTANCE_ID, process.env.MC_AGENT_NAME, process.env.MC_INSTANCE_ROLE]
  );
};
```

---

## Files Changed

### New Files
- `scripts/deploy-to-agent.sh`
- `docs/agent-configs.md`
- `env.template`

### Modified Files
- `src/app/api/health/detailed/route.ts`
- `src/lib/scheduler.ts` - Add heartbeat job

---

## Rollback Plan

If deployment fails on an agent:

```bash
# Stop MC
pm2 stop mission-control

# Revert to previous version
git checkout HEAD~1

# Rebuild and restart
pnpm build
pm2 start mission-control
```

---

## Sign-Off

- [ ] All agents deployed
- [ ] Multi-instance sync working
- [ ] Job distribution working
- [ ] Failure scenarios tested

**Approved by:** ________________  
**Date:** ________________
