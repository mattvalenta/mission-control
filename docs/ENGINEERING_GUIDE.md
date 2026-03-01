# Mission Control - Engineering Guide

**Version:** 2.1.0  
**Last Updated:** March 1, 2026  
**Status:** Architecture Redesign - Updated with Dev Manager Review

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture: Distributed Mission Control](#target-architecture-distributed-mission-control)
4. [Features to Adopt from Builderz-Labs](#features-to-adopt-from-builderz-labs)
5. [Database Schema](#database-schema)
6. [Real-Time Synchronization](#real-time-synchronization)
7. [Distributed Job Queue](#distributed-job-queue)
8. [Dead Letter Queue](#dead-letter-queue)
9. [Circuit Breaker Pattern](#circuit-breaker-pattern)
10. [Token Pricing & Cost Calculation](#token-pricing--cost-calculation)
11. [Migration Strategy](#migration-strategy)
12. [API Reference](#api-reference)
13. [Implementation Roadmap](#implementation-roadmap)
14. [Security Considerations](#security-considerations)
15. [Monitoring & Observability](#monitoring--observability)
16. [Dev Manager Review Summary](#dev-manager-review-summary)

---

## Executive Summary

Mission Control is the central orchestration dashboard for Paramount Lead Solutions' multi-agent AI workforce. It coordinates task dispatch, planning, execution monitoring, and agent lifecycle management across a distributed fleet of AI agents running on separate machines.

### Key Capabilities

- **Multi-machine agent orchestration** - Agents run on separate machines, coordinated via shared state
- **Interactive planning workflow** - Q&A-driven task refinement before dispatch
- **Real-time updates** - SSE for browser clients, LISTEN/NOTIFY for cross-machine sync
- **Tiered agent hierarchy** - Skippy (master) → Managers → Subagents
- **Content pipeline** - Social media content workflow from idea to published

### Strategic Direction

This guide documents the transition from:
- **Current:** Single dashboard with remote agent polling
- **Target:** Distributed system where each agent runs Mission Control locally, synchronized via PostgreSQL

---

## Current Architecture

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SKIPPY'S MACHINE (Gateway Host)                   │
│                                                                      │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐ │
│  │ Mission Control │◄───►│ OpenClaw Gateway│◄───►│    Skippy     │ │
│  │   (Port 4000)   │ WS  │   (Port 18789)  │     │   (Master)    │ │
│  │   SQLite DB     │     │                 │     │               │ │
│  └────────┬────────┘     └────────┬────────┘     └───────┬───────┘ │
│           │                       │                       │         │
│           ▼                       ▼                       ▼         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL (Neon Cloud)                   │   │
│  │  • agent_messages (inter-agent communication)                │   │
│  │  • mc_tasks (task sync - partial)                            │   │
│  │  • social_media_posts (content management)                   │   │
│  └──────────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
  │ Dev Manager │         │  Insights   │         │ Marketing   │
  │  (Remote)   │         │  (Remote)   │         │  (Remote)   │
  │             │         │             │         │             │
  │ Poll Script │         │ Poll Script │         │ Poll Script │
  │ + Discord   │         │ + Discord   │         │ + Discord   │
  └─────────────┘         └─────────────┘         └─────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, React 18, TypeScript | Dashboard UI |
| State | Zustand 5 | Client-side state management |
| Real-time | Server-Sent Events (SSE) | Browser push notifications |
| Local DB | SQLite (better-sqlite3) | Task queue, agents, activities |
| Shared DB | PostgreSQL (Neon) | Cross-machine state sync |
| Gateway | OpenClaw Gateway | Agent session management |
| Communication | Discord | Inter-agent messaging |

### Current Limitations

1. **Single point of failure** - Skippy's machine hosts the only Mission Control instance
2. **Polling overhead** - Remote agents poll PostgreSQL every 30 seconds
3. **Limited visibility** - Remote agents can't see the dashboard
4. **Background jobs on one machine** - Scheduler only runs on Skippy's machine
5. **No token tracking** - API costs are invisible

---

## Target Architecture: Distributed Mission Control

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SKIPPY'S MACHINE                              │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     │
│  │ Mission Ctrl  │     │ OpenClaw GW   │     │    Skippy     │     │
│  │  (Local UI)   │     │  (Port 18789) │     │   (Master)    │     │
│  └───────┬───────┘     └───────────────┘     └───────────────┘     │
│          │                                                          │
└──────────┼──────────────────────────────────────────────────────────┘
           │
           │  PostgreSQL Connection + LISTEN/NOTIFY
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL (NEON CLOUD)                         │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      SHARED TABLES                               ││
│  │  • tasks, agents, activities, deliverables                       ││
│  │  • token_usage, audit_log, quality_reviews                       ││
│  │  • job_queue, dead_letter_queue (distributed task execution)     ││
│  │  • mc_instances (instance registry)                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    NOTIFICATION CHANNELS                         ││
│  │  • task_updates    → Broadcast task changes                      ││
│  │  • agent_updates   → Broadcast agent status changes              ││
│  │  • activity_updates → Broadcast new activities                   ││
│  │  • job_available   → Signal new background job                   ││
│  │  • alerts          → Dead letter queue alerts                    ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           │ LISTEN/NOTIFY      │ LISTEN/NOTIFY      │ LISTEN/NOTIFY
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   DEV MANAGER    │  │  INSIGHTS MGR    │  │  MARKETING MGR   │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │Mission Ctrl│  │  │  │Mission Ctrl│  │  │  │Mission Ctrl│  │
│  │ (Local UI) │  │  │  │ (Local UI) │  │  │  │ (Local UI) │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │OpenClaw GW │  │  │  │OpenClaw GW │  │  │  │OpenClaw GW │  │
│  │  (Local)   │  │  │  │  (Local)   │  │  │  │  (Local)   │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
│  ┌────────────┐  │  │  ┌────────────┐  │  │  ┌────────────┐  │
│  │Dev Manager │  │  │  │ Insights   │  │  │  │ Marketing  │  │
│  │   Agent    │  │  │  │  Manager   │  │  │  │  Manager   │  │
│  └────────────┘  │  │  └────────────┘  │  │  └────────────┘  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Key Design Principles

1. **PostgreSQL as Source of Truth** - All shared state lives in PostgreSQL
2. **LISTEN/NOTIFY for Real-Time** - Push-based updates, no polling
3. **Instance Autonomy** - Each MC works independently, syncs when connected
4. **Distributed Job Execution** - Background tasks run on any available instance
5. **Gateway per Agent** - Each agent controls its own OpenClaw Gateway

---

## Features to Adopt from Builderz-Labs

The [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) repository implements several features worth incorporating.

### Priority Matrix

| Feature | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Token Usage & Cost Tracking | 🔴 High | 4-6 hours | High visibility into costs |
| Audit Logging | 🔴 High | 2-3 hours | Security & debugging |
| Dead Letter Queue | 🔴 High | 2 hours | Reliability |
| Background Scheduler | 🟡 Medium | 3-4 hours | Automation |
| Outbound Webhooks | 🟡 Medium | 3-4 hours | Integration |
| Circuit Breaker | 🟡 Medium | 3 hours | Reliability |
| Quality Review Gates | 🟡 Medium | 2-3 hours | Workflow control |
| Rate Limiting | 🟢 Low | 1-2 hours | Security (internal only) |
| RBAC | 🟢 Low | 4-5 hours | Multi-user (not needed now) |

### 1. Token Usage & Cost Tracking 🔴 HIGH PRIORITY

**Schema Addition:**
```sql
-- Token usage tracking
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX idx_token_usage_task ON token_usage(task_id);
CREATE INDEX idx_token_usage_date ON token_usage(created_at);
CREATE INDEX idx_token_usage_model ON token_usage(model);
```

### 2. Audit Logging 🔴 HIGH PRIORITY

**Schema Addition:**
```sql
-- Audit log for security and admin events
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_id TEXT,
  actor_instance TEXT,  -- Which MC instance performed the action
  target_type TEXT,
  target_id TEXT,
  detail JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
```

### 3. Background Scheduler 🟡 MEDIUM PRIORITY

**Schema Addition:**
```sql
-- Scheduled jobs
CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  handler TEXT NOT NULL,  -- Handler function name
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
  instance_id TEXT NOT NULL,  -- Which MC instance ran it
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_executions_job ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);
```

### 4. Outbound Webhooks 🟡 MEDIUM PRIORITY

**Schema Addition:**
```sql
-- Webhook definitions
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,  -- For HMAC signature
  events JSONB NOT NULL,  -- Array of event types to trigger on
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook delivery history
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt TIMESTAMP,
  response_code INTEGER,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries(status) 
  WHERE status IN ('pending', 'retrying');
```

### 5. Quality Review Gates 🟡 MEDIUM PRIORITY

**Schema Addition:**
```sql
-- Quality reviews
CREATE TABLE quality_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_reviews_task ON quality_reviews(task_id);
CREATE INDEX idx_quality_reviews_status ON quality_reviews(status);
```

### 6. Rate Limiting 🟢 LOW PRIORITY

```typescript
// src/lib/rate-limit.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: NextRequest) => string;
}

export function rateLimiter(config: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 100,
  keyGenerator: (req) => req.headers.get('x-forwarded-for') || 'unknown'
}) {
  const requests = new Map<string, number[]>();
  
  return (req: NextRequest): NextResponse | null => {
    const key = config.keyGenerator(req);
    const now = Date.now();
    const timestamps = (requests.get(key) || []).filter(t => t > now - config.windowMs);
    
    if (timestamps.length >= config.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: config.windowMs / 1000 },
        { status: 429 }
      );
    }
    
    requests.set(key, [...timestamps, now]);
    return null;
  };
}
```

### 7. Feature Flags 🟡 MEDIUM PRIORITY

**Schema Addition:**
```sql
-- Feature flags for gradual rollout
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 8. Metrics Collection 🟡 MEDIUM PRIORITY

**Schema Addition:**
```sql
-- Metrics collection
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value REAL NOT NULL,
  tags JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_name_date ON metrics(name, created_at DESC);
```

---

## Database Schema

### Complete Schema (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MISSION CONTROL INSTANCES
-- ============================================================

CREATE TABLE mc_instances (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  hostname TEXT,
  ip_address TEXT,
  role TEXT CHECK (role IN ('master', 'worker')),
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'degraded')),
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP DEFAULT NOW(),
  version TEXT
);

CREATE INDEX idx_mc_instances_status ON mc_instances(status);

-- ============================================================
-- WORKSPACES
-- ============================================================

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AGENTS
-- ============================================================

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline', 'error')),
  is_master INTEGER DEFAULT 0,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT REFERENCES agents(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  model TEXT,
  discord_channel TEXT,
  instance_id TEXT REFERENCES mc_instances(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_workspace ON agents(workspace_id);
CREATE INDEX idx_agents_tier ON agents(tier);
CREATE INDEX idx_agents_manager ON agents(manager_id);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'quality_review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TIMESTAMP,
  version INTEGER DEFAULT 1,
  
  -- Planning fields
  planning_session_key TEXT,
  planning_messages JSONB,
  planning_complete BOOLEAN DEFAULT false,
  planning_spec TEXT,
  planning_agents JSONB,
  planning_dispatch_error TEXT,
  
  -- Tier fields
  tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT,
  subagent_type TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_tier ON tasks(tier);

-- ============================================================
-- TOKEN USAGE
-- ============================================================

CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX idx_token_usage_task ON token_usage(task_id);
CREATE INDEX idx_token_usage_date ON token_usage(created_at);
CREATE INDEX idx_token_usage_model ON token_usage(model);

-- ============================================================
-- DEAD LETTER QUEUE
-- ============================================================

CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX idx_dlq_created ON dead_letter_queue(created_at DESC);
CREATE INDEX idx_dlq_resolved ON dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- SCHEDULED JOBS
-- ============================================================

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

CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT REFERENCES scheduled_jobs(id),
  instance_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_job_executions_job ON job_executions(job_id);
CREATE INDEX idx_job_executions_status ON job_executions(status);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_id TEXT,
  actor_instance TEXT,
  target_type TEXT,
  target_id TEXT,
  detail JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================
-- WEBHOOKS
-- ============================================================

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_attempt TIMESTAMP,
  response_code INTEGER,
  response_body TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_pending ON webhook_deliveries(status) 
  WHERE status IN ('pending', 'retrying');

-- ============================================================
-- FEATURE FLAGS
-- ============================================================

CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- METRICS
-- ============================================================

CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  value REAL NOT NULL,
  tags JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_name_date ON metrics(name, created_at DESC);

-- ============================================================
-- [Additional tables: planning, activities, etc. - see full schema in repo]
-- ============================================================
```

---

## Real-Time Synchronization

### PostgreSQL LISTEN/NOTIFY

#### ⚠️ Critical Limitations (from Dev Manager Review)

| Issue | Risk | Mitigation |
|-------|------|------------|
| Payload size limit (8KB) | 🔴 High | Send ID + fetch pattern |
| Connection drop handling | 🟡 Medium | Add reconnection logic |
| Missed notifications during downtime | 🟡 Medium | Hybrid poll fallback |
| Ordering guarantees | ✅ OK | Order preserved within connection |

#### Recommended Pattern

```typescript
// src/lib/db/notify.ts
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const listenPool = new Pool({ connectionString: process.env.POSTGRES_URL });

export type NotificationChannel = 
  | 'task_updates' 
  | 'agent_updates' 
  | 'activity_updates'
  | 'deliverable_updates'
  | 'job_available'
  | 'alerts';

// ⚠️ KEY: Don't send full payload - send reference only
// Payload must be under 8KB
export async function broadcastNotification(
  channel: NotificationChannel, 
  type: string, 
  data: any
) {
  const instanceId = process.env.MC_INSTANCE_ID || 'unknown';
  const payload = JSON.stringify({ type, instanceId, timestamp: Date.now(), data });
  
  // If payload > 7KB, store and reference
  if (payload.length > 7000) {
    const notificationId = await storeNotification(data);
    await pool.query('SELECT pg_notify($1, $2)', [
      channel, 
      JSON.stringify({ type, instanceId, timestamp: Date.now(), notificationId, truncated: true })
    ]);
  } else {
    await pool.query('SELECT pg_notify($1, $2)', [channel, payload]);
  }
}

// Robust listener with reconnection
export async function startNotificationListener(
  onNotification: (channel: NotificationChannel, payload: any) => void
) {
  let client = await listenPool.connect();
  
  const setupListener = async () => {
    await client.query('LISTEN task_updates');
    await client.query('LISTEN agent_updates');
    await client.query('LISTEN activity_updates');
    await client.query('LISTEN deliverable_updates');
    await client.query('LISTEN job_available');
    await client.query('LISTEN alerts');
  };
  
  await setupListener();
  
  client.on('notification', (msg) => {
    if (msg.channel && msg.payload) {
      try {
        const payload = JSON.parse(msg.payload);
        // If truncated, fetch full data
        if (payload.truncated && payload.notificationId) {
          payload.data = await fetchNotification(payload.notificationId);
        }
        onNotification(msg.channel as NotificationChannel, payload);
      } catch (err) {
        console.error('Failed to parse notification:', err);
      }
    }
  });
  
  // Reconnection logic
  client.on('error', async (err) => {
    console.error('[NOTIFY] Connection error:', err);
    try { client.release(); } catch {}
    setTimeout(async () => {
      try {
        client = await listenPool.connect();
        await setupListener();
      } catch (reconnectErr) {
        console.error('[NOTIFY] Reconnection failed:', reconnectErr);
      }
    }, 5000);
  });
}

// Hybrid approach - LISTEN/NOTIFY + periodic poll fallback
const NOTIFY_TIMEOUT = 30000; // 30 seconds

export function setupHybridSync(onUpdate: (changes: any[]) => void) {
  let lastNotification = Date.now();
  
  startNotificationListener((channel, payload) => {
    lastNotification = Date.now();
    onUpdate([payload]);
  });
  
  // If no notification received for 30 seconds, poll for updates
  setInterval(async () => {
    if (Date.now() - lastNotification > NOTIFY_TIMEOUT) {
      const changes = await fetchChangesSince(lastNotification);
      if (changes.length > 0) {
        onUpdate(changes);
      }
    }
  }, NOTIFY_TIMEOUT);
}
```

---

## Distributed Job Queue

### Advisory Lock Pattern

#### ⚠️ Fixed: Use PostgreSQL hashtext() (from Dev Manager Review)

**Problem:** The original hash function used 32-bit integers, which has collision risk with 100+ jobs.

**Solution:** Use PostgreSQL's built-in `hashtext()` which returns 64-bit:

```sql
-- Use PostgreSQL's hashtext for collision-resistant locking
SELECT pg_try_advisory_lock(hashtext('cleanup-stale-sessions'));

-- Or use bigint range directly
SELECT pg_try_advisory_lock(abs(('x'||substr(md5('cleanup-stale-sessions'),1,16))::bit(64)::bigint));
```

### Complete Implementation

```typescript
// src/lib/scheduler.ts
import { queryOne, run, queryAll } from './db';

const INSTANCE_ID = process.env.MC_INSTANCE_ID || 'unknown';
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 minutes

// Job claim with heartbeat and circuit breaker
export async function claimAndRunJob(jobName: string): Promise<boolean> {
  // Check circuit breaker first
  const failures = await queryOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM job_executions 
     WHERE instance_id = $1 
       AND status = 'failed' 
       AND started_at > NOW() - INTERVAL '1 hour'`,
    [INSTANCE_ID]
  );
  
  if (failures && failures.count >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[CIRCUIT] Instance ${INSTANCE_ID} in circuit-open state`);
    return false;
  }
  
  // Use PostgreSQL hashtext for collision-resistant lock
  const lockResult = await queryOne<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) as locked',
    [jobName]
  );
  
  if (!lockResult?.locked) {
    return false;  // Another instance has this job
  }
  
  try {
    // Check if job is due
    const job = await queryOne<{ id: string; handler: string; interval_seconds: number }>(
      `SELECT id, handler, interval_seconds 
       FROM scheduled_jobs 
       WHERE name = $1 AND enabled = true 
         AND (next_run IS NULL OR next_run <= NOW())`,
      [jobName]
    );
    
    if (!job) {
      return false;
    }
    
    // Record execution start
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO job_executions (job_id, instance_id, status, started_at)
       VALUES ($1, $2, 'running', NOW())
       RETURNING id`,
      [job.id, INSTANCE_ID]
    );
    
    try {
      await runJobHandler(job.handler);
      
      await run(
        `UPDATE job_executions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [execution!.id]
      );
      
      await run(
        `UPDATE scheduled_jobs 
         SET last_run = NOW(), 
             next_run = NOW() + (interval_seconds * INTERVAL '1 second')
         WHERE id = $1`,
        [job.id]
      );
      
      return true;
    } catch (err) {
      await run(
        `UPDATE job_executions SET status = 'failed', completed_at = NOW(), error = $1 WHERE id = $2`,
        [String(err), execution!.id]
      );
      
      // Check if we should move to DLQ
      const failCount = await queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM job_executions 
         WHERE job_id = $1 AND status = 'failed' AND started_at > NOW() - INTERVAL '1 day'`,
        [job.id]
      );
      
      if (failCount && failCount.count >= 3) {
        await moveToDeadLetterQueue(jobName, job, String(err), failCount.count);
      }
      
      throw err;
    }
  } finally {
    await run('SELECT pg_advisory_unlock(hashtext($1))', [jobName]);
  }
}

// Heartbeat during long jobs
export function startHeartbeat(jobId: string) {
  return setInterval(async () => {
    await run(
      `UPDATE job_executions SET heartbeat_at = NOW() 
       WHERE id = $1 AND status = 'running'`,
      [jobId]
    );
  }, 60000);  // Every minute
}
```

---

## Dead Letter Queue

### Schema

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX idx_dlq_created ON dead_letter_queue(created_at DESC);
CREATE INDEX idx_dlq_resolved ON dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;
```

### Implementation

```typescript
// Move failed job to DLQ after max retries
async function moveToDeadLetterQueue(
  jobName: string, 
  job: any, 
  failureReason: string,
  retryCount: number
) {
  await run(
    `INSERT INTO dead_letter_queue (job_name, payload, failure_reason, retry_count)
     VALUES ($1, $2, $3, $4)`,
    [jobName, JSON.stringify(job), failureReason, retryCount]
  );
  
  // Alert via notification channel
  await pool.query(`SELECT pg_notify('alerts', $1)`, [
    JSON.stringify({
      type: 'job_dead_lettered',
      job_name: jobName,
      failure_reason: failureReason,
      timestamp: Date.now()
    })
  ]);
  
  // Disable the failing job
  await run(
    `UPDATE scheduled_jobs SET enabled = false WHERE name = $1`,
    [jobName]
  );
}

// Admin UI for reviewing DLQ
export async function getDeadLetterQueue(limit = 50) {
  return queryAll(
    `SELECT * FROM dead_letter_queue 
     WHERE resolved_at IS NULL 
     ORDER BY created_at DESC 
     LIMIT $1`,
    [limit]
  );
}

export async function retryFromDLQ(dlqId: string) {
  const dlq = await queryOne<any>(
    'SELECT * FROM dead_letter_queue WHERE id = $1',
    [dlqId]
  );
  
  if (!dlq) return false;
  
  // Re-enable job and reset next_run
  await run(
    `UPDATE scheduled_jobs SET enabled = true, next_run = NOW() WHERE name = $1`,
    [dlq.job_name]
  );
  
  // Mark DLQ entry as resolved
  await run(
    `UPDATE dead_letter_queue SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
    [INSTANCE_ID, dlqId]
  );
  
  return true;
}
```

---

## Circuit Breaker Pattern

### Implementation

```typescript
// src/lib/circuit-breaker.ts
const agentHealth = new Map<string, { failures: number; lastFailure: Date }>();

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
  
  // Log to audit
  logAuditEvent({
    action: 'agent_failure',
    actor: 'circuit_breaker',
    target_type: 'agent',
    target_id: agentId,
    detail: { failure_count: health.failures }
  });
}

export function recordAgentSuccess(agentId: string) {
  agentHealth.set(agentId, { failures: 0, lastFailure: new Date() });
}
```

---

## Token Pricing & Cost Calculation

### Model Pricing Table

```typescript
// src/lib/token-pricing.ts
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI (per 1M tokens)
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  
  // Anthropic (per 1M tokens)
  'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-5-haiku': { input: 0.80, output: 4.00 },
  'claude-3-opus': { input: 15.00, output: 75.00 },
  
  // OpenRouter (average, per 1M tokens)
  'openrouter/auto': { input: 1.00, output: 3.00 },
  'openrouter/openai/gpt-4o': { input: 2.50, output: 10.00 },
  
  // Moonshot (per 1M tokens)
  'moonshot/kimi-k2.5': { input: 0.50, output: 2.00 },
  
  // Gemini (per 1M tokens)
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
};

export function calculateCost(
  model: string, 
  inputTokens: number, 
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 1.00, output: 3.00 };  // Default fallback
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}

// Record token usage
export async function recordTokenUsage(data: {
  sessionId?: string;
  agentId?: string;
  taskId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}) {
  const totalTokens = data.inputTokens + data.outputTokens;
  const cost = calculateCost(data.model, data.inputTokens, data.outputTokens);
  
  await run(
    `INSERT INTO token_usage (session_id, agent_id, task_id, model, input_tokens, output_tokens, total_tokens, cost)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [data.sessionId, data.agentId, data.taskId, data.model, data.inputTokens, data.outputTokens, totalTokens, cost]
  );
  
  return { totalTokens, cost };
}
```

---

## Migration Strategy

### Phase 1.5: Migration Procedure (Added from Dev Manager Review)

#### Pre-Migration Checklist

```
□ Full SQLite backup created
□ Data exported to JSON (for validation)
□ PostgreSQL schema created in Neon
□ Connection verified from all agent machines
□ Rollback plan documented
□ Maintenance window scheduled (2-4 hours)
□ All stakeholders notified
```

#### Migration Day Procedure

```
1. STOP PHASE (15 minutes)
   □ Stop all Mission Control instances
   □ Stop all agent polling scripts
   □ Verify no active tasks in progress
   
2. BACKUP PHASE (10 minutes)
   □ Create SQLite backup: cp mission-control.db mission-control.db.pre-migration
   □ Export data to JSON: node scripts/export-sqlite-to-json.ts
   □ Verify backup integrity
   
3. MIGRATE PHASE (30-60 minutes)
   □ Run migration script: node scripts/migrate-sqlite-to-postgres.ts
   □ Validate row counts match:
     - tasks: SQLite X = PostgreSQL Y
     - agents: SQLite X = PostgreSQL Y
     - activities: SQLite X = PostgreSQL Y
   □ Validate data integrity (spot checks)
   
4. STARTUP PHASE (15 minutes)
   □ Update environment: DATABASE_URL=postgresql://...
   □ Start Skippy's MC with PostgreSQL
   □ Verify dashboard loads
   □ Test basic operations (create task, update status)
   □ Start other MC instances one by one
   
5. VALIDATION PHASE (30 minutes)
   □ Test task dispatch flow
   □ Test agent communication
   □ Test real-time updates
   □ Monitor for errors
```

#### Rollback Plan

```
If issues detected:

1. IMMEDIATE (5 minutes)
   □ Stop all PostgreSQL MC instances
   □ Revert environment: DATABASE_URL=sqlite://...
   
2. RESTORE (10 minutes)
   □ Restore SQLite: cp mission-control.db.pre-migration mission-control.db
   □ Restart MC instances with SQLite
   
3. INVESTIGATE
   □ Collect error logs
   □ Document failure mode
   □ Fix issues in migration script
   
4. RETRY
   □ Schedule new migration window
   □ Apply fixes
   □ Retry migration
```

#### Migration Script Template

```typescript
// scripts/migrate-sqlite-to-postgres.ts
import Database from 'better-sqlite3';
import { Pool } from 'pg';

const sqlite = new Database('./mission-control.db');
const pg = new Pool({ connectionString: process.env.POSTGRES_URL });

async function migrate() {
  console.log('[MIGRATE] Starting migration...');
  
  // Migrate agents
  const agents = sqlite.prepare('SELECT * FROM agents').all();
  console.log(`[MIGRATE] Migrating ${agents.length} agents...`);
  for (const agent of agents) {
    await pg.query(`
      INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET ...`, [...]);
  }
  
  // Migrate tasks
  const tasks = sqlite.prepare('SELECT * FROM tasks').all();
  console.log(`[MIGRATE] Migrating ${tasks.length} tasks...`);
  // ... similar pattern
  
  // Validate counts
  const pgAgentCount = await pg.query('SELECT COUNT(*) FROM agents');
  if (pgAgentCount.rows[0].count !== agents.length) {
    throw new Error('Agent count mismatch!');
  }
  
  console.log('[MIGRATE] Migration complete!');
}
```

---

## Implementation Roadmap

### Updated Timeline (12 Weeks - Extended from Dev Manager Review)

| Phase | Duration | Risk | Recommended |
|-------|----------|------|-------------|
| Phase 1: PostgreSQL Migration | 2 weeks | 🔴 High | **3 weeks** |
| Phase 2: LISTEN/NOTIFY | 1 week | 🟡 Medium | 1 week |
| Phase 3: Token Tracking | 1 week | 🟢 Low | 1 week |
| Phase 4: Quality Gates | 1 week | 🟢 Low | 1 week |
| Phase 5: Job Queue + DLQ | 1 week | 🟡 Medium | **1.5 weeks** |
| Phase 6: Audit Logging | 1 week | 🟢 Low | 0.5 weeks |
| Phase 7: Webhooks | 1 week | 🟡 Medium | 1 week |
| Phase 8: Deploy to Agents | 1 week | 🔴 High | **2 weeks** |
| Phase 9: Rate Limit/RBAC | 1 week | 🟢 Low | 1 week |
| **Testing & Polish** | - | 🔴 High | **2 weeks** |
| **Total** | **9 weeks** | | **12 weeks** |

### Phase 1: PostgreSQL Migration (Weeks 1-3)

**Goal:** Replace SQLite with PostgreSQL as primary database.

**Tasks:**
- [ ] Create complete PostgreSQL schema
- [ ] Create migration scripts (SQLite → PostgreSQL)
- [ ] Create backup and rollback procedures
- [ ] Test migration on staging environment
- [ ] Validate data integrity post-migration
- [ ] Update all API routes to use PostgreSQL
- [ ] Update query syntax (datetime → NOW(), etc.)
- [ ] Deploy to production with rollback plan

**Success Criteria:**
- All existing functionality works with PostgreSQL
- No SQLite usage
- All tests pass
- Rollback procedure tested

---

### Phase 2: LISTEN/NOTIFY Integration (Week 4)

**Goal:** Real-time synchronization across MC instances.

**Tasks:**
- [ ] Implement notification listener service with reconnection
- [ ] Add broadcast calls to all mutation endpoints
- [ ] Implement hybrid poll fallback
- [ ] Create React hooks for notification handling
- [ ] Add database triggers for automatic notifications
- [ ] Test multi-instance sync

**Success Criteria:**
- Changes in one MC appear instantly in others
- Latency < 100ms
- Works during network partitions (fallback)

---

### Phase 3: Token Usage Tracking (Week 5)

**Goal:** Visibility into API costs.

**Tasks:**
- [ ] Add token_usage table
- [ ] Create token recording API
- [ ] Add token pricing table
- [ ] Add token tracking to agent dispatch flow
- [ ] Create token dashboard UI
- [ ] Add trend charts

---

### Phase 4: Quality Review Gates (Week 6)

**Goal:** Formal approval workflow.

**Tasks:**
- [ ] Add quality_reviews table
- [ ] Add `quality_review` status to tasks
- [ ] Create review API endpoints
- [ ] Update task workflow UI
- [ ] Add review history display

---

### Phase 5: Job Queue + DLQ + Circuit Breaker (Weeks 7-8)

**Goal:** Distributed job execution with reliability.

**Tasks:**
- [ ] Add scheduled_jobs and job_executions tables
- [ ] Implement advisory lock job claiming with hashtext()
- [ ] Add Dead Letter Queue
- [ ] Add circuit breaker pattern
- [ ] Create job handlers for existing cron tasks
- [ ] Migrate existing cron jobs to scheduler
- [ ] Add scheduler UI

---

### Phase 6: Audit Logging (Week 8)

**Goal:** Security forensics and compliance.

**Tasks:**
- [ ] Add audit_log table
- [ ] Add logging to all security-relevant actions
- [ ] Create audit API endpoints
- [ ] Add audit log viewer UI
- [ ] Set up retention policy (90 days)

---

### Phase 7: Webhooks (Week 9)

**Goal:** External system integration.

**Tasks:**
- [ ] Add webhooks and webhook_deliveries tables
- [ ] Create webhook CRUD API
- [ ] Implement webhook delivery with retry
- [ ] Add HMAC signature verification
- [ ] Create webhook management UI

---

### Phase 8: Deploy to All Agents (Weeks 10-11)

**Goal:** Each agent runs Mission Control locally.

**Tasks:**
- [ ] Create MC_INSTANCE_ID for each agent
- [ ] Deploy Mission Control to each agent's machine
- [ ] Configure PostgreSQL connection strings
- [ ] Test multi-instance coordination
- [ ] Document agent setup process
- [ ] Create runbooks for common issues

---

### Phase 9: Testing & Polish (Weeks 11-12)

**Goal:** Production hardening.

**Tasks:**
- [ ] End-to-end testing of all features
- [ ] Load testing with multiple instances
- [ ] Failure scenario testing (network partitions, crashes)
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Monitoring and alerting setup

---

### Phase 10: Rate Limiting & RBAC (Optional - Week 12+)

**Goal:** Security hardening (if needed for external access).

---

## Security Considerations

### Authentication

**Current:** Single API token (MC_API_TOKEN)

**Target:** Multi-layer auth
- Session cookies for browser users
- API keys for programmatic access
- Discord OAuth for agent identity (existing)

### Rate Limiting

Since this is an internal agent dashboard, rate limiting may be overkill unless exposing to external users. Consider for:
- Public demo instances
- Multi-tenant deployments

### Network Security

- All PostgreSQL connections over SSL
- API tokens stored securely (env vars, not code)
- Webhook secrets for HMAC verification
- Rate limiting to prevent abuse

---

## Monitoring & Observability

### Health Endpoints

```
GET /api/health          - Basic health check
GET /api/health/detailed - Detailed status including DB, Gateway
GET /api/status          - System metrics (uptime, memory, disk)
```

### Metrics to Track

- Active MC instances
- Database connection pool status
- WebSocket connection status
- Token usage trends
- Job execution success rate
- Dead Letter Queue size
- API response times

### Alerting

Configure alerts for:
- MC instance goes offline
- Database connection failures
- High token usage (cost threshold)
- Failed job executions
- Items in Dead Letter Queue
- Failed webhook deliveries

---

## Dev Manager Review Summary

### Overall Assessment

**Architecture is sound.** The guide covers the major concerns for distributed agent orchestration.

### Critical Issues Addressed

| Issue | Severity | Resolution |
|-------|----------|------------|
| LISTEN/NOTIFY 8KB limit | 🔴 High | Added reference pattern + reconnection logic |
| Advisory lock collision | 🟡 Medium | Fixed: Use PostgreSQL hashtext() |
| Dead Letter Queue | 🔴 High | Added DLQ table and alerting |
| Migration strategy | 🔴 High | Added detailed migration procedure |
| Circuit breaker | 🟡 Medium | Added to job claiming logic |
| Token pricing | 🟡 Medium | Added pricing table and calculation |
| Timeline | 🟡 Medium | Extended to 12 weeks |
| Missing features | 🟡 Medium | Added metrics, backup, feature flags |

### Final Verdict

✅ **Ready for implementation** with the additions documented in this guide.

---

## References

### Internal
- [Current Implementation](../README.md)
- [Orchestration Guide](../ORCHESTRATION.md)
- [Agent Setup](../agent-resources/docs/AGENT_SETUP.md)

### External
- [Builderz Labs Mission Control](https://github.com/builderz-labs/mission-control)
- [PostgreSQL LISTEN/NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Neon PostgreSQL](https://neon.tech/docs/introduction)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.1.0 | 2026-03-01 | Added Dev Manager review feedback: DLQ, circuit breaker, migration strategy, extended timeline |
| 2.0.0 | 2026-03-01 | Distributed architecture redesign |
| 1.1.0 | 2026-02-16 | Added real-time SSE, activities, deliverables |
| 1.0.0 | 2026-02-01 | Initial release |

---

*This document is maintained by the Mission Control engineering team. For questions, contact Skippy (Master Agent) or create an issue in the repository.*
