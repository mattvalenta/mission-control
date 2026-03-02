# Phase 5: Job Queue + DLQ + Circuit Breaker

**Duration:** 1.5 Weeks  
**Priority:** 🔴 High  
**Risk Level:** Medium  
**Dependencies:** Phase 1 (PostgreSQL Migration), Phase 2 (LISTEN/NOTIFY)

---

## Objective

Implement distributed job queue with PostgreSQL advisory locks for coordination across multiple MC instances. Add Dead Letter Queue for failed jobs and Circuit Breaker to prevent cascading failures.

---

## Success Criteria

- [ ] Jobs run exactly once across all instances
- [ ] Advisory locks prevent duplicate execution
- [ ] Failed jobs go to DLQ after max retries
- [ ] Circuit breaker stops dispatch to failing agents
- [ ] Job history tracked per instance
- [ ] Admin UI for DLQ management

---

## Week 1: Job Queue Foundation

### Day 1-2: Schema

#### 1.1 Create Job Queue Schema
- [ ] Create scheduled_jobs table
- [ ] Create job_executions table
- [ ] Create dead_letter_queue table

```sql
-- Scheduled jobs
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  handler TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job execution history
CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT REFERENCES scheduled_jobs(id),
  instance_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  heartbeat_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_executions_job ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
CREATE INDEX idx_job_executions_instance ON job_executions(instance_id);

-- Dead Letter Queue
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  original_job_id TEXT,
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX idx_dlq_created ON dead_letter_queue(created_at DESC);
CREATE INDEX idx_dlq_resolved ON dead_letter_queue(resolved_at) 
  WHERE resolved_at IS NULL;
```

### Day 3-4: Core Implementation

#### 2.1 Create Scheduler Module
- [ ] Create `src/lib/scheduler.ts`
- [ ] Implement advisory lock claiming
- [ ] Implement job claiming with `hashtext()`
- [ ] Add heartbeat mechanism

**CRITICAL:** Use PostgreSQL `hashtext()` for 64-bit collision-resistant locks:

```typescript
// src/lib/scheduler.ts
const INSTANCE_ID = process.env.MC_INSTANCE_ID || 'unknown';

export async function claimAndRunJob(jobName: string): Promise<boolean> {
  // Use hashtext() for collision-resistant 64-bit lock
  const lockResult = await queryOne<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) as locked',
    [jobName]
  );
  
  if (!lockResult?.locked) {
    return false; // Another instance has this job
  }
  
  try {
    // Check if job is due
    const job = await queryOne<{ id: string; handler: string }>(
      `SELECT id, handler FROM scheduled_jobs 
       WHERE name = $1 AND enabled = true 
         AND (next_run IS NULL OR next_run <= NOW())`,
      [jobName]
    );
    
    if (!job) return false;
    
    // Record execution
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO job_executions (job_id, instance_id, status, started_at)
       VALUES ($1, $2, 'running', NOW()) RETURNING id`,
      [job.id, INSTANCE_ID]
    );
    
    // Start heartbeat for long jobs
    const heartbeat = startHeartbeat(execution!.id);
    
    try {
      await runJobHandler(job.handler);
      await completeJob(execution!.id, job.id);
      return true;
    } catch (err) {
      await failJob(execution!.id, String(err));
      throw err;
    } finally {
      clearInterval(heartbeat);
    }
  } finally {
    await run('SELECT pg_advisory_unlock(hashtext($1))', [jobName]);
  }
}

function startHeartbeat(executionId: string) {
  return setInterval(async () => {
    await run(
      `UPDATE job_executions SET heartbeat_at = NOW() WHERE id = $1`,
      [executionId]
    );
  }, 60000);
}
```

#### 2.2 Create Job Handlers Registry
- [ ] Define handler interface
- [ ] Create handlers for existing cron jobs

```typescript
const handlers: Record<string, () => Promise<void>> = {
  'cleanup-stale-sessions': async () => {
    await run(
      `UPDATE openclaw_sessions SET status = 'inactive' 
       WHERE status = 'active' AND updated_at < NOW() - INTERVAL '2 hours'`
    );
  },
  
  'check-agent-heartbeats': async () => {
    await run(
      `UPDATE agents SET status = 'offline' 
       WHERE status != 'offline' AND updated_at < NOW() - INTERVAL '5 minutes'`
    );
  },
  
  'cleanup-old-audit-logs': async () => {
    await run(
      `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
    );
  },
  
  'cleanup-old-notifications': async () => {
    await run(
      `DELETE FROM notification_payloads WHERE created_at < NOW() - INTERVAL '1 hour'`
    );
  },
};
```

---

## Week 2: DLQ & Circuit Breaker

### Day 1-2: Dead Letter Queue

#### 3.1 Implement DLQ Logic
- [ ] Move failed jobs to DLQ after 3 failures
- [ ] Disable failing jobs automatically
- [ ] Alert on DLQ addition

```typescript
async function failJob(executionId: string, error: string) {
  await run(
    `UPDATE job_executions SET status = 'failed', error = $1, completed_at = NOW() 
     WHERE id = $2`,
    [error, executionId]
  );
  
  // Check failure count
  const job = await queryOne<{ job_id: string; name: string }>(
    `SELECT j.job_id, sj.name FROM job_executions j
     JOIN scheduled_jobs sj ON j.job_id = sj.id
     WHERE j.id = $1`,
    [executionId]
  );
  
  const failCount = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM job_executions 
     WHERE job_id = $1 AND status = 'failed' 
       AND started_at > NOW() - INTERVAL '1 day'`,
    [job?.job_id]
  );
  
  if (failCount && failCount.count >= 3) {
    await moveToDLQ(job!.name, job!.job_id, error, failCount.count);
  }
}

async function moveToDLQ(jobName: string, jobId: string, error: string, retryCount: number) {
  await run(
    `INSERT INTO dead_letter_queue (job_name, original_job_id, failure_reason, retry_count)
     VALUES ($1, $2, $3, $4)`,
    [jobName, jobId, error, retryCount]
  );
  
  // Disable the failing job
  await run(
    `UPDATE scheduled_jobs SET enabled = false WHERE name = $1`,
    [jobName]
  );
  
  // Alert via notification
  await broadcastNotification('alerts', 'job_dead_lettered', {
    jobName,
    error,
    retryCount
  });
}
```

#### 3.2 Create DLQ Admin UI
- [ ] Create `src/components/DLQPanel.tsx`
- [ ] List failed jobs
- [ ] Add retry/resolve buttons

### Day 3-4: Circuit Breaker

#### 4.1 Implement Circuit Breaker
- [ ] Track agent failures
- [ ] Open circuit after 3 failures
- [ ] Auto-close after 5 minutes

```typescript
// src/lib/circuit-breaker.ts
const agentHealth = new Map<string, { failures: number; lastFailure: Date }>();
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes

export function canDispatchToAgent(agentId: string): boolean {
  const health = agentHealth.get(agentId);
  if (!health) return true;
  
  // Circuit open for 5 minutes after 3 consecutive failures
  if (health.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    const timeSinceFailure = Date.now() - health.lastFailure.getTime();
    return timeSinceFailure > CIRCUIT_BREAKER_TIMEOUT;
  }
  
  return true;
}

export function recordAgentFailure(agentId: string) {
  const health = agentHealth.get(agentId) || { failures: 0, lastFailure: new Date() };
  health.failures++;
  health.lastFailure = new Date();
  agentHealth.set(agentId, health);
}

export function recordAgentSuccess(agentId: string) {
  agentHealth.set(agentId, { failures: 0, lastFailure: new Date() });
}
```

#### 4.2 Integrate with Dispatch
- [ ] Check circuit breaker before dispatch
- [ ] Record success/failure after dispatch

```typescript
// In dispatch route
if (!canDispatchToAgent(agent.id)) {
  return NextResponse.json({
    error: 'Agent circuit breaker open',
    retryAfter: 300 // seconds
  }, { status: 503 });
}

try {
  await dispatchToAgent(agent, task);
  recordAgentSuccess(agent.id);
} catch (err) {
  recordAgentFailure(agent.id);
  throw err;
}
```

### Day 5: Testing

- [ ] Job claiming works with multiple instances
- [ ] Only one instance runs each job
- [ ] DLQ receives failed jobs
- [ ] Circuit breaker prevents dispatch
- [ ] Heartbeat updates during long jobs

---

## Built-in Jobs

| Job Name | Handler | Interval | Purpose |
|----------|---------|----------|---------|
| cleanup-stale-sessions | cleanupStaleSessions | 1 hour | Mark old sessions inactive |
| check-agent-heartbeats | checkAgentHeartbeats | 30 min | Mark offline agents |
| cleanup-old-audit-logs | cleanupOldAuditLogs | 7 days | Remove old logs |
| cleanup-old-notifications | cleanupOldNotifications | 1 hour | Remove old payloads |
| aggregate-token-usage | aggregateTokenUsage | 1 hour | Pre-calculate stats |

---

## Files Changed

### New Files
- `src/lib/scheduler.ts`
- `src/lib/circuit-breaker.ts`
- `src/app/api/scheduler/route.ts`
- `src/app/api/scheduler/[id]/route.ts`
- `src/app/api/dlq/route.ts`
- `src/components/SchedulerPanel.tsx`
- `src/components/DLQPanel.tsx`
- `migrations/007_job_queue.sql`

### Modified Files
- `src/app/api/tasks/[id]/dispatch/route.ts` - Add circuit breaker
- `src/app/api/agents/[id]/route.ts` - Track dispatch results
- `instrumentation.ts` - Start scheduler on boot

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Advisory lock collision | Use hashtext() for 64-bit |
| Job runs twice | FOR UPDATE SKIP LOCKED |
| Agent crash mid-job | Heartbeat + timeout |
| DLQ overflow | Auto-cleanup after 7 days |

---

## Sign-Off

- [ ] Job claiming tested with multiple instances
- [ ] DLQ working
- [ ] Circuit breaker working
- [ ] Heartbeat working

**Approved by:** ________________  
**Date:** ________________
