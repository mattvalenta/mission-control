# Mission Control - Engineering Guide

**Version:** 2.0.0  
**Last Updated:** March 1, 2026  
**Status:** Architecture Redesign

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Target Architecture: Distributed Mission Control](#target-architecture-distributed-mission-control)
4. [Features to Adopt from Builderz-Labs](#features-to-adopt-from-builderz-labs)
5. [Database Schema](#database-schema)
6. [Real-Time Synchronization](#real-time-synchronization)
7. [Distributed Job Queue](#distributed-job-queue)
8. [API Reference](#api-reference)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Security Considerations](#security-considerations)
11. [Monitoring & Observability](#monitoring--observability)

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
│  │  • job_queue (distributed task execution)                        ││
│  │  • mc_instances (instance registry)                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                    NOTIFICATION CHANNELS                         ││
│  │  • task_updates    → Broadcast task changes                      ││
│  │  • agent_updates   → Broadcast agent status changes              ││
│  │  • activity_updates → Broadcast new activities                   ││
│  │  • job_available   → Signal new background job                   ││
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

### Instance Identity

Each Mission Control instance identifies itself:

```typescript
// Environment variables for each instance
MC_INSTANCE_ID=dev-manager-mac-mini
MC_INSTANCE_ROLE=worker  // 'master' or 'worker'
MC_AGENT_NAME=Dev Manager

// Auto-generated on startup if not set
const instanceId = process.env.MC_INSTANCE_ID || `${os.hostname()}-${Date.now()}`;
```

### Conflict Resolution

**Optimistic Locking** for concurrent updates:

```sql
-- Add version column to contested tables
ALTER TABLE tasks ADD COLUMN version INTEGER DEFAULT 1;

-- Update with version check
UPDATE tasks 
SET status = 'in_progress', version = version + 1, updated_at = NOW()
WHERE id = $1 AND version = $2;

-- If affected_rows = 0, another instance updated first
-- Application must retry with fresh data
```

---

## Features to Adopt from Builderz-Labs

The [builderz-labs/mission-control](https://github.com/builderz-labs/mission-control) repository implements several features worth incorporating. Below is the complete feature adoption plan.

### 1. Token Usage & Cost Tracking ⭐ HIGH PRIORITY

**Why:** Visibility into API costs per agent, per model, per task.

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

**API Endpoints:**
```
GET  /api/tokens              - List token usage with filters
GET  /api/tokens/summary      - Aggregated stats (by agent, model, date range)
GET  /api/tokens/trends       - Time-series data for charts
```

**UI Components:**
- Token usage dashboard with per-model breakdown
- Trend charts (Recharts integration)
- Cost analysis by agent

---

### 2. Quality Review Gates ⭐ HIGH PRIORITY

**Why:** Formal approval workflow prevents premature task completion.

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

**Task Status Update:**
```sql
-- Add quality_review status to tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'quality_review', 'done'));
```

**API Endpoints:**
```
POST /api/tasks/:id/review    - Submit quality review
GET  /api/tasks/:id/reviews   - List all reviews for task
```

**Workflow:**
1. Agent completes work → sets status to `review`
2. Reviewer approves/rejects → creates quality_review record
3. If approved → status changes to `quality_review` → Master can set to `done`
4. If rejected → status returns to `in_progress` with notes

---

### 3. Audit Logging ⭐ HIGH PRIORITY

**Why:** Security forensics, compliance, debugging.

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

**Tracked Actions:**
- `login`, `logout`, `login_failed`
- `user_created`, `user_deleted`, `password_change`
- `agent_created`, `agent_deleted`
- `task_created`, `task_deleted`, `task_dispatched`
- `settings_changed`
- `api_key_generated`, `api_key_revoked`

**API Endpoints:**
```
GET /api/audit               - List audit events (admin only)
GET /api/audit/security      - Security-specific events (failed logins, etc.)
```

---

### 4. Rate Limiting ⭐ MEDIUM PRIORITY

**Why:** Prevent API abuse, protect against runaway agents.

**Implementation:**
```typescript
// src/lib/rate-limit.ts
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: NextRequest) => string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000,  // 1 minute
  maxRequests: 100,
  keyGenerator: (req) => req.headers.get('x-forwarded-for') || 'unknown'
};

export function rateLimiter(config: RateLimitConfig = defaultConfig) {
  const requests = new Map<string, number[]>();
  
  return (req: NextRequest): NextResponse | null => {
    const key = config.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    const timestamps = (requests.get(key) || []).filter(t => t > windowStart);
    
    if (timestamps.length >= config.maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: config.windowMs / 1000 },
        { status: 429, headers: { 'Retry-After': String(config.windowMs / 1000) } }
      );
    }
    
    requests.set(key, [...timestamps, now]);
    return null; // Allow request
  };
}
```

**Apply to mutation endpoints:**
```typescript
// In API routes
const rateCheck = rateLimiter()(request);
if (rateCheck) return rateCheck;
```

---

### 5. Background Scheduler ⭐ MEDIUM PRIORITY

**Why:** Automated maintenance, health checks, cleanup.

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

**Built-in Jobs:**
```typescript
const builtinJobs = [
  {
    name: 'cleanup-stale-sessions',
    handler: 'cleanupStaleSessions',
    interval_seconds: 3600,  // 1 hour
  },
  {
    name: 'backup-database',
    handler: 'backupDatabase',
    interval_seconds: 86400,  // 24 hours
  },
  {
    name: 'check-agent-heartbeats',
    handler: 'checkAgentHeartbeats',
    interval_seconds: 1800,  // 30 minutes
  },
  {
    name: 'aggregate-token-usage',
    handler: 'aggregateTokenUsage',
    interval_seconds: 3600,  // 1 hour
  },
  {
    name: 'cleanup-old-audit-logs',
    handler: 'cleanupOldAuditLogs',
    interval_seconds: 604800,  // 7 days
  },
];
```

**Distributed Execution:**
```typescript
// Only one instance runs each job
async function claimAndRunJob(jobName: string, instanceId: string) {
  const result = await queryOne<{ id: string }>(
    `UPDATE scheduled_jobs 
     SET last_run = NOW(), next_run = NOW() + (interval_seconds * INTERVAL '1 second')
     WHERE name = $1 
       AND (next_run IS NULL OR next_run <= NOW())
       AND pg_try_advisory_lock(hashtext(name))
     RETURNING id`,
    [jobName]
  );
  
  if (result) {
    await runJobHandler(jobName);
    await run(`SELECT pg_advisory_unlock(hashtext($1))`, [jobName]);
  }
}
```

---

### 6. Outbound Webhooks ⭐ MEDIUM PRIORITY

**Why:** Integration with external systems (Slack, email, custom handlers).

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

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) 
  WHERE status IN ('pending', 'retrying');
```

**Triggered Events:**
- `task.created`, `task.completed`, `task.failed`
- `agent.status_changed`
- `quality_review.submitted`
- `token_threshold_exceeded`

**Delivery with Retry:**
```typescript
async function deliverWebhook(webhookId: string, eventType: string, payload: any) {
  const webhook = await queryOne<Webhook>('SELECT * FROM webhooks WHERE id = $1', [webhookId]);
  if (!webhook || !webhook.enabled) return;
  
  const delivery = await queryOne<WebhookDelivery>(
    `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING *`,
    [webhookId, eventType, JSON.stringify(payload)]
  );
  
  // Process delivery in background
  processWebhookDelivery(delivery.id);
}

async function processWebhookDelivery(deliveryId: string) {
  // Exponential backoff retry: 1m, 5m, 15m
  // HMAC signature for verification
  // Record response code and body
}
```

---

### 7. Role-Based Access Control (RBAC) ⭐ LOW PRIORITY

**Why:** Multi-user access with different permission levels.

**Schema Addition:**
```sql
-- Users table (for human users, not agents)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions for browser auth
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_token ON user_sessions(token);
```

**Permission Matrix:**
```typescript
const permissions = {
  viewer: [
    'read:tasks', 'read:agents', 'read:activities', 'read:deliverables',
    'read:token_usage', 'read:calendar'
  ],
  operator: [
    'read:tasks', 'write:tasks', 'dispatch:tasks',
    'read:agents', 'write:agents', 'spawn:agents',
    'read:activities', 'write:activities',
    'read:deliverables', 'write:deliverables',
    'submit:reviews'
  ],
  admin: [
    '*'  // Full access
  ]
};
```

**Implementation:**
```typescript
// src/lib/auth.ts
export function requireRole(req: NextRequest, requiredRole: 'viewer' | 'operator' | 'admin') {
  const session = getSessionFromRequest(req);
  if (!session) return { error: 'Unauthorized', status: 401 };
  
  const roleHierarchy = { viewer: 0, operator: 1, admin: 2 };
  if (roleHierarchy[session.user.role] < roleHierarchy[requiredRole]) {
    return { error: 'Forbidden', status: 403 };
  }
  
  return { user: session.user };
}
```

---

### 8. Smart Polling with Visibility Detection ⭐ LOW PRIORITY

**Why:** Reduce unnecessary updates when tab is hidden.

**Implementation:**
```typescript
// src/hooks/useSmartPolling.ts
export function useSmartPolling(refreshFn: () => void, intervalMs: number) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isPausedRef = useRef(false);
  
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalRef.current);
        isPausedRef.current = true;
      } else {
        isPausedRef.current = false;
        refreshFn();  // Immediate refresh when tab becomes visible
        intervalRef.current = setInterval(refreshFn, intervalMs);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    intervalRef.current = setInterval(refreshFn, intervalMs);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(intervalRef.current);
    };
  }, [refreshFn, intervalMs]);
  
  return { isPaused: isPausedRef.current };
}
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
-- PLANNING
-- ============================================================

CREATE TABLE planning_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options JSONB,
  answer TEXT,
  answered_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_planning_questions_task ON planning_questions(task_id, sort_order);

CREATE TABLE planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TIMESTAMP NOT NULL,
  locked_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TASK ACTIVITIES & DELIVERABLES
-- ============================================================

CREATE TABLE task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activities_task ON task_activities(task_id, created_at DESC);

CREATE TABLE task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('file', 'url', 'artifact')),
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_deliverables_task ON task_deliverables(task_id);

-- ============================================================
-- OPENCLAW SESSIONS
-- ============================================================

CREATE TABLE openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active',
  session_type TEXT DEFAULT 'persistent' CHECK (session_type IN ('persistent', 'subagent')),
  task_id TEXT REFERENCES tasks(id),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_openclaw_sessions_agent ON openclaw_sessions(agent_id);
CREATE INDEX idx_openclaw_sessions_task ON openclaw_sessions(task_id);

-- ============================================================
-- TOKEN USAGE
-- ============================================================

CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- QUALITY REVIEWS
-- ============================================================

CREATE TABLE quality_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_reviews_task ON quality_reviews(task_id);
CREATE INDEX idx_quality_reviews_status ON quality_reviews(status);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- SCHEDULED JOBS
-- ============================================================

CREATE TABLE scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  handler TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE job_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- WEBHOOKS
-- ============================================================

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
-- CONTENT PIPELINE
-- ============================================================

CREATE TABLE content_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linkedin_post', 'x_post', 'x_thread', 'carousel', 'blog')),
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'facebook', 'instagram')),
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea', 'research', 'draft', 'humanize', 'schedule', 'publish', 'analysis')),
  content TEXT,
  research TEXT,
  schedule TEXT,
  analysis TEXT,
  assigned_to TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX idx_content_items_stage ON content_items(stage);
CREATE INDEX idx_content_items_platform ON content_items(platform);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('cron', 'meeting', 'deadline', 'reminder')),
  tier TEXT NOT NULL DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  color TEXT,
  recurring TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_events_agent ON calendar_events(agent_id);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================

CREATE TABLE team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('skippy', 'manager', 'subagent')),
  role TEXT NOT NULL,
  manager_id TEXT REFERENCES team_members(id),
  status TEXT DEFAULT 'offline' CHECK (status IN ('active', 'idle', 'on-demand', 'offline')),
  discord_id TEXT,
  workspace_path TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_team_members_tier ON team_members(tier);
CREATE INDEX idx_team_members_manager ON team_members(manager_id);

-- ============================================================
-- USERS (RBAC)
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_token ON user_sessions(token);

-- ============================================================
-- EVENTS (LIVE FEED)
-- ============================================================

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_created ON events(created_at DESC);
```

---

## Real-Time Synchronization

### PostgreSQL LISTEN/NOTIFY

Each Mission Control instance subscribes to PostgreSQL notification channels:

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
  | 'job_available';

export interface NotificationPayload {
  type: string;
  instanceId: string;
  timestamp: number;
  data: any;
}

// Start listening on all channels
export async function startNotificationListener(
  onNotification: (channel: NotificationChannel, payload: NotificationPayload) => void
) {
  const client = await listenPool.connect();
  
  // Subscribe to all channels
  await client.query('LISTEN task_updates');
  await client.query('LISTEN agent_updates');
  await client.query('LISTEN activity_updates');
  await client.query('LISTEN deliverable_updates');
  await client.query('LISTEN job_available');
  
  client.on('notification', (msg) => {
    if (msg.channel && msg.payload) {
      try {
        const payload = JSON.parse(msg.payload) as NotificationPayload;
        onNotification(msg.channel as NotificationChannel, payload);
      } catch (err) {
        console.error('Failed to parse notification:', err);
      }
    }
  });
  
  console.log('[NOTIFY] Listening for PostgreSQL notifications');
}

// Broadcast a notification
export async function broadcastNotification(
  channel: NotificationChannel, 
  type: string, 
  data: any
) {
  const instanceId = process.env.MC_INSTANCE_ID || 'unknown';
  const payload: NotificationPayload = {
    type,
    instanceId,
    timestamp: Date.now(),
    data
  };
  
  await pool.query(
    'SELECT pg_notify($1, $2)',
    [channel, JSON.stringify(payload)]
  );
}

// Helper functions for common broadcasts
export const notify = {
  taskUpdated: (taskId: string, updates: any) => 
    broadcastNotification('task_updates', 'task_updated', { taskId, updates }),
  
  taskCreated: (task: any) => 
    broadcastNotification('task_updates', 'task_created', { task }),
  
  agentStatusChanged: (agentId: string, status: string) => 
    broadcastNotification('agent_updates', 'agent_status_changed', { agentId, status }),
  
  activityLogged: (taskId: string, activity: any) => 
    broadcastNotification('activity_updates', 'activity_logged', { taskId, activity }),
  
  deliverableAdded: (taskId: string, deliverable: any) => 
    broadcastNotification('deliverable_updates', 'deliverable_added', { taskId, deliverable }),
  
  jobAvailable: (jobName: string) => 
    broadcastNotification('job_available', 'job_available', { jobName }),
};
```

### React Hook for Notifications

```typescript
// src/hooks/useNotifications.ts
import { useEffect } from 'react';
import { useMissionControl } from '@/store';
import { startNotificationListener, NotificationChannel, NotificationPayload } from '@/lib/db/notify';

export function useNotifications() {
  const { 
    updateTask, 
    addTask, 
    updateAgent, 
    addActivity, 
    addDeliverable 
  } = useMissionControl();
  
  useEffect(() => {
    const cleanup = startNotificationListener((channel, payload) => {
      // Ignore own notifications
      if (payload.instanceId === process.env.NEXT_PUBLIC_MC_INSTANCE_ID) {
        return;
      }
      
      switch (channel) {
        case 'task_updates':
          if (payload.type === 'task_created') {
            addTask(payload.data.task);
          } else if (payload.type === 'task_updated') {
            updateTask(payload.data.taskId, payload.data.updates);
          }
          break;
          
        case 'agent_updates':
          updateAgent(payload.data.agentId, payload.data);
          break;
          
        case 'activity_updates':
          addActivity(payload.data.taskId, payload.data.activity);
          break;
          
        case 'deliverable_updates':
          addDeliverable(payload.data.taskId, payload.data.deliverable);
          break;
          
        case 'job_available':
          // Trigger job claim attempt
          attemptJobClaim(payload.data.jobName);
          break;
      }
    });
    
    return cleanup;
  }, []);
}
```

### Database Triggers for Automatic Notifications

```sql
-- Automatically notify on task changes
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('task_updates', json_build_object(
    'type', 'task_updated',
    'instanceId', 'database_trigger',
    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000,
    'data', json_build_object('taskId', NEW.id, 'updates', row_to_json(NEW))
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_notify AFTER UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_task_change();
```

---

## Distributed Job Queue

### Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ MC Instance │  │ MC Instance │  │ MC Instance │
│   (Skippy)  │  │(Dev Manager)│  │(Marketing)  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       │                │                │
       ▼                ▼                ▼
┌─────────────────────────────────────────────┐
│            PostgreSQL Job Queue             │
│                                             │
│  scheduled_jobs (job definitions)          │
│  job_executions (run history)              │
│  pg_advisory_lock (coordination)           │
└─────────────────────────────────────────────┘
```

### Job Claiming with Advisory Locks

```typescript
// src/lib/scheduler.ts
import { queryOne, run } from './db';

const INSTANCE_ID = process.env.MC_INSTANCE_ID || 'unknown';

// Hash job name to integer for advisory lock
function hashJobName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash;  // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Try to claim and run a job
export async function claimAndRunJob(jobName: string): Promise<boolean> {
  const lockId = hashJobName(jobName);
  
  // Try to acquire advisory lock
  const lockResult = await queryOne<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock($1) as locked',
    [lockId]
  );
  
  if (!lockResult?.locked) {
    // Another instance is already running this job
    return false;
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
      return false;  // Not due yet
    }
    
    // Record execution start
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO job_executions (job_id, instance_id, status, started_at)
       VALUES ($1, $2, 'running', NOW())
       RETURNING id`,
      [job.id, INSTANCE_ID]
    );
    
    try {
      // Run the handler
      await runJobHandler(job.handler);
      
      // Mark success
      await run(
        `UPDATE job_executions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [execution!.id]
      );
      
      // Schedule next run
      await run(
        `UPDATE scheduled_jobs 
         SET last_run = NOW(), 
             next_run = NOW() + (interval_seconds * INTERVAL '1 second')
         WHERE id = $1`,
        [job.id]
      );
      
      return true;
    } catch (err) {
      // Mark failed
      await run(
        `UPDATE job_executions SET status = 'failed', completed_at = NOW(), error = $1 WHERE id = $2`,
        [String(err), execution!.id]
      );
      throw err;
    }
  } finally {
    // Always release lock
    await run('SELECT pg_advisory_unlock($1)', [lockId]);
  }
}

// Job handlers registry
const handlers: Record<string, () => Promise<void>> = {
  cleanupStaleSessions: async () => {
    await run(
      `UPDATE openclaw_sessions SET status = 'inactive' 
       WHERE status = 'active' AND updated_at < NOW() - INTERVAL '2 hours'`
    );
  },
  
  checkAgentHeartbeats: async () => {
    await run(
      `UPDATE agents SET status = 'offline' 
       WHERE status != 'offline' AND updated_at < NOW() - INTERVAL '5 minutes'`
    );
  },
  
  cleanupOldAuditLogs: async () => {
    await run(
      `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
    );
  },
  
  aggregateTokenUsage: async () => {
    // Aggregate hourly stats into daily stats table (if using)
  },
  
  backupDatabase: async () => {
    // Trigger backup via Neon API or pg_dump
  },
};

async function runJobHandler(handlerName: string) {
  const handler = handlers[handlerName];
  if (!handler) {
    throw new Error(`Unknown job handler: ${handlerName}`);
  }
  await handler();
}
```

### Scheduler Loop

```typescript
// Start scheduler loop on each MC instance
export function startScheduler() {
  // Poll for jobs every minute
  setInterval(async () => {
    // Get list of enabled jobs
    const jobs = await queryAll<{ name: string }>(
      `SELECT name FROM scheduled_jobs WHERE enabled = true`
    );
    
    // Try to claim each job
    for (const job of jobs) {
      claimAndRunJob(job.name).catch(err => {
        console.error(`Job ${job.name} failed:`, err);
      });
    }
  }, 60000);  // 1 minute interval
}
```

---

## API Reference

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks with filters |
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task details |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| POST | `/api/tasks/:id/dispatch` | Dispatch to agent |
| POST | `/api/tasks/:id/review` | Submit quality review |
| GET | `/api/tasks/:id/activities` | Get activity log |
| POST | `/api/tasks/:id/activities` | Log activity |
| GET | `/api/tasks/:id/deliverables` | Get deliverables |
| POST | `/api/tasks/:id/deliverables` | Add deliverable |

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| GET | `/api/agents/:id` | Get agent details |
| PATCH | `/api/agents/:id` | Update agent |
| DELETE | `/api/agents/:id` | Delete agent |
| POST | `/api/agents/:id/heartbeat` | Agent heartbeat |
| POST | `/api/agents/:id/wake` | Wake sleeping agent |

### Planning

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks/:id/planning` | Start planning session |
| GET | `/api/tasks/:id/planning` | Get planning state |
| POST | `/api/tasks/:id/planning/questions` | Add questions |
| POST | `/api/tasks/:id/planning/answer` | Submit answer |
| POST | `/api/tasks/:id/planning/complete` | Complete planning |

### Token Usage

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tokens` | List token usage |
| GET | `/api/tokens/summary` | Aggregated stats |
| GET | `/api/tokens/trends` | Time-series data |
| POST | `/api/tokens` | Record usage |

### Quality Reviews

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks/:id/reviews` | List reviews |
| POST | `/api/tasks/:id/reviews` | Submit review |

### Audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit` | List audit events |
| GET | `/api/audit/security` | Security events |

### Scheduler

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scheduler` | List scheduled jobs |
| POST | `/api/scheduler` | Create job |
| PATCH | `/api/scheduler/:id` | Update job |
| DELETE | `/api/scheduler/:id` | Delete job |
| GET | `/api/scheduler/executions` | Execution history |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/webhooks` | List webhooks |
| POST | `/api/webhooks` | Create webhook |
| PATCH | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| GET | `/api/webhooks/deliveries` | Delivery history |

---

## Implementation Roadmap

### Phase 1: PostgreSQL Migration (Week 1-2)

**Goal:** Replace SQLite with PostgreSQL as primary database.

**Tasks:**
- [ ] Create complete PostgreSQL schema (see Database Schema section)
- [ ] Create database migration scripts (SQLite → PostgreSQL)
- [ ] Update all API routes to use PostgreSQL
- [ ] Update query syntax (datetime → NOW(), etc.)
- [ ] Test all endpoints
- [ ] Deploy to production

**Success Criteria:**
- All existing functionality works with PostgreSQL
- No SQLite usage
- All tests pass

---

### Phase 2: LISTEN/NOTIFY Integration (Week 2-3)

**Goal:** Real-time synchronization across MC instances.

**Tasks:**
- [ ] Implement notification listener service
- [ ] Add broadcast calls to all mutation endpoints
- [ ] Create React hooks for notification handling
- [ ] Add database triggers for automatic notifications
- [ ] Test multi-instance sync

**Success Criteria:**
- Changes in one MC appear instantly in others
- No polling required for state sync
- Latency < 100ms

---

### Phase 3: Token Usage Tracking (Week 3)

**Goal:** Visibility into API costs.

**Tasks:**
- [ ] Add token_usage table
- [ ] Create token recording API
- [ ] Add token tracking to agent dispatch flow
- [ ] Create token dashboard UI
- [ ] Add trend charts

**Success Criteria:**
- All agent API calls tracked
- Per-agent, per-model costs visible
- Historical trends available

---

### Phase 4: Quality Review Gates (Week 4)

**Goal:** Formal approval workflow.

**Tasks:**
- [ ] Add quality_reviews table
- [ ] Add `quality_review` status to tasks
- [ ] Create review API endpoints
- [ ] Update task workflow UI
- [ ] Add review history display

**Success Criteria:**
- Tasks require approval before completion
- Review history tracked
- Notification on review submission

---

### Phase 5: Distributed Job Queue (Week 4-5)

**Goal:** Background jobs run on any available instance.

**Tasks:**
- [ ] Add scheduled_jobs and job_executions tables
- [ ] Implement advisory lock job claiming
- [ ] Create job handlers for existing cron tasks
- [ ] Migrate existing cron jobs to scheduler
- [ ] Add scheduler UI

**Success Criteria:**
- Jobs run exactly once across all instances
- Job history tracked per instance
- Failed jobs logged with error details

---

### Phase 6: Audit Logging (Week 5)

**Goal:** Security forensics and compliance.

**Tasks:**
- [ ] Add audit_log table
- [ ] Add logging to all security-relevant actions
- [ ] Create audit API endpoints
- [ ] Add audit log viewer UI
- [ ] Set up retention policy

**Success Criteria:**
- All security events logged
- Logs searchable by action, actor, date
- Retention policy enforced

---

### Phase 7: Webhooks (Week 6)

**Goal:** External system integration.

**Tasks:**
- [ ] Add webhooks and webhook_deliveries tables
- [ ] Create webhook CRUD API
- [ ] Implement webhook delivery with retry
- [ ] Add HMAC signature verification
- [ ] Create webhook management UI

**Success Criteria:**
- Webhooks fire on configured events
- Retry logic works
- Delivery history visible

---

### Phase 8: Deploy to All Agents (Week 6-7)

**Goal:** Each agent runs Mission Control locally.

**Tasks:**
- [ ] Create MC_INSTANCE_ID for each agent
- [ ] Deploy Mission Control to each agent's machine
- [ ] Configure PostgreSQL connection strings
- [ ] Test multi-instance coordination
- [ ] Document agent setup process

**Success Criteria:**
- Each agent has local MC dashboard
- All instances stay in sync
- No single point of failure

---

### Phase 9: Rate Limiting & RBAC (Week 7-8)

**Goal:** Security hardening.

**Tasks:**
- [ ] Implement rate limiting middleware
- [ ] Add users table for human access
- [ ] Implement RBAC permission checks
- [ ] Create user management UI
- [ ] Test permission boundaries

**Success Criteria:**
- API abuse prevented
- Different user roles work correctly
- Admin-only endpoints protected

---

## Security Considerations

### Authentication

**Current:** Single API token (MC_API_TOKEN)

**Target:** Multi-layer auth
- Session cookies for browser users
- API keys for programmatic access
- Discord OAuth for agent identity (existing)

### Authorization

**RBAC Roles:**
- `viewer` - Read-only access
- `operator` - Can create/update tasks, spawn agents
- `admin` - Full access including settings and user management

### Network Security

- All PostgreSQL connections over SSL
- API tokens stored securely (env vars, not code)
- Webhook secrets for HMAC verification
- Rate limiting to prevent abuse

### Audit Trail

All security-relevant events logged:
- Authentication attempts
- Permission changes
- Agent lifecycle events
- Settings modifications

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
- API response times

### Alerting

Configure alerts for:
- MC instance goes offline
- Database connection failures
- High token usage (cost threshold)
- Failed job executions
- Failed webhook deliveries

---

## References

### Internal
- [Current Implementation](../README.md)
- [Orchestration Guide](../ORCHESTRATION.md)
- [Agent Setup](../agent-resources/docs/AGENT_SETUP.md)
- [Implementation Guide](../IMPLEMENTATION_GUIDE.md)

### External
- [Builderz Labs Mission Control](https://github.com/builderz-labs/mission-control) - Reference implementation
- [PostgreSQL LISTEN/NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)
- [PostgreSQL Advisory Locks](https://www.postgresql.org/docs/current/explicit-locking.html#ADVISORY-LOCKS)
- [Neon PostgreSQL](https://neon.tech/docs/introduction)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0.0 | 2026-03-01 | Distributed architecture redesign |
| 1.1.0 | 2026-02-16 | Added real-time SSE, activities, deliverables |
| 1.0.0 | 2026-02-01 | Initial release |

---

*This document is maintained by the Mission Control engineering team. For questions, contact Skippy (Master Agent) or create an issue in the repository.*
