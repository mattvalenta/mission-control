# Mission Control Multi-Agent Implementation Guide

Complete guide for adapting Mission Control to work with our distributed multi-agent system.

## Phase 0: Architecture Overview

### Current Mission Control Design
- Single SQLite database
- WebSocket connection to one OpenClaw Gateway
- Tasks assigned to local agents only
- No agent-to-agent communication

### Our Target Architecture
```
┌───────────────────────────────────────────────────────────────────────┐
│                    SKIPPY'S MACHINE (Master Controller)                │
│                                                                       │
│  ┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐   │
│  │ Mission Control │◄───►│ OpenClaw Gateway│◄───►│    Skippy     │   │
│  │   (Port 4000)   │ WS  │   (Port 18789)  │     │   (Master)    │   │
│  └────────┬────────┘     └────────┬────────┘     └───────┬───────┘   │
│           │                       │                       │           │
│           ▼                       ▼                       ▼           │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL (Neon Cloud)                             │ │
│  │   - agent_messages (existing)                                    │ │
│  │   - mc_tasks (new - synced from SQLite)                          │ │
│  │   - mc_agents (new - synced from SQLite)                         │ │
│  └──────────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────────┼─────────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
  │ Dev-Manager │         │  Insights   │         │ Marketing   │
  │  (Machine)  │         │  (Machine)  │         │  (Machine)  │
  └─────────────┘         └─────────────┘         └─────────────┘
```

### Key Changes Required

| Component | Current | Target |
|-----------|---------|--------|
| Database | SQLite local | PostgreSQL + SQLite sync |
| Agent Access | Browser UI only | PostgreSQL queries |
| Clarifications | Direct to user | Route to Skippy |
| Multi-Machine | Not supported | Agent fleet via PostgreSQL |

---

## Phase 1: Database Migration

### 1.1 Create PostgreSQL Tables

**File:** `supabase/migrations/001_mission_control_tables.sql`

```sql
-- Mission Control Tasks (synced from SQLite)
CREATE TABLE IF NOT EXISTS mc_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'inbox',
    priority TEXT DEFAULT 'normal',
    assigned_agent_id TEXT,
    created_by_agent_id TEXT,
    workspace_id TEXT DEFAULT 'default',
    planning_session_key TEXT,
    planning_complete INTEGER DEFAULT 0,
    planning_spec TEXT,
    deliverables TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Sync metadata
    sqlite_synced_at TIMESTAMPTZ,
    source_machine TEXT
);

-- Mission Control Agents (synced from SQLite)
CREATE TABLE IF NOT EXISTS mc_agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'standby',
    is_master INTEGER DEFAULT 0,
    workspace_id TEXT DEFAULT 'default',
    machine_hostname TEXT,  -- NEW: which machine this agent runs on
    openclaw_url TEXT,      -- NEW: WebSocket URL to agent's OpenClaw
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Clarification Queue (for routing to Skippy)
CREATE TABLE IF NOT EXISTS clarification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id TEXT REFERENCES mc_tasks(id),
    from_agent TEXT NOT NULL,
    question TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    options TEXT,  -- JSON array
    answer TEXT,
    answered_by TEXT,  -- 'skippy' or 'matt'
    answered_at TIMESTAMPTZ,
    escalated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mc_tasks_status ON mc_tasks(status);
CREATE INDEX IF NOT EXISTS idx_mc_tasks_assigned ON mc_tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_mc_agents_machine ON mc_agents(machine_hostname);
CREATE INDEX IF NOT EXISTS idx_clarification_pending ON clarification_queue(answered_at) WHERE answered_at IS NULL;
```

### 1.2 Add Sync Service

**File:** `src/lib/db/sync-service.ts`

```typescript
import { Pool } from 'pg';
import { getDb } from './index';

const POSTGRES_URL = process.env.POSTGRES_URL!;
const MACHINE_HOSTNAME = process.env.MACHINE_HOSTNAME || 'localhost';

let pgPool: Pool | null = null;

export function getPostgresPool(): Pool {
  if (!pgPool) {
    pgPool = new Pool({ connectionString: POSTGRES_URL });
  }
  return pgPool;
}

/**
 * Sync tasks from SQLite to PostgreSQL
 */
export async function syncTasksToPostgres(): Promise<void> {
  const db = getDb();
  const pg = getPostgresPool();
  const now = new Date().toISOString();

  // Get all tasks from SQLite
  const tasks = db.prepare(`
    SELECT * FROM tasks
  `).all() as any[];

  for (const task of tasks) {
    await pg.query(`
      INSERT INTO mc_tasks (
        id, title, description, status, priority,
        assigned_agent_id, created_by_agent_id, workspace_id,
        planning_session_key, planning_complete, planning_spec,
        created_at, updated_at, sqlite_synced_at, source_machine
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        assigned_agent_id = EXCLUDED.assigned_agent_id,
        updated_at = EXCLUDED.updated_at,
        sqlite_synced_at = EXCLUDED.sqlite_synced_at
    `, [
      task.id, task.title, task.description, task.status, task.priority,
      task.assigned_agent_id, task.created_by_agent_id, task.workspace_id,
      task.planning_session_key, task.planning_complete, task.planning_spec,
      task.created_at, task.updated_at, now, MACHINE_HOSTNAME
    ]);
  }

  console.log(`[Sync] Synced ${tasks.length} tasks to PostgreSQL`);
}

/**
 * Sync agents from SQLite to PostgreSQL
 */
export async function syncAgentsToPostgres(): Promise<void> {
  const db = getDb();
  const pg = getPostgresPool();
  const now = new Date().toISOString();

  const agents = db.prepare(`SELECT * FROM agents`).all() as any[];

  for (const agent of agents) {
    await pg.query(`
      INSERT INTO mc_agents (
        id, name, role, description, status, is_master,
        workspace_id, machine_hostname, openclaw_url,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
    `, [
      agent.id, agent.name, agent.role, agent.description,
      agent.status, agent.is_master, agent.workspace_id,
      MACHINE_HOSTNAME,
      `ws://${process.env.OPENCLAW_HOST || 'localhost'}:18789`,
      agent.created_at, agent.updated_at
    ]);
  }

  console.log(`[Sync] Synced ${agents.length} agents to PostgreSQL`);
}

/**
 * Start periodic sync (every 5 seconds)
 */
export function startSyncService(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      await syncTasksToPostgres();
      await syncAgentsToPostgres();
    } catch (err) {
      console.error('[Sync] Error:', err);
    }
  }, 5000);
}
```

### 1.3 Update Environment

**File:** `.env.local`

```bash
# Existing OpenClaw config
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=c7b7e4ec47da2d5818ba5b69b1626abc8e574747b4a0b87c

# NEW: PostgreSQL for multi-agent sync
POSTGRES_URL=postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw?sslmode=require

# NEW: Machine identification
MACHINE_HOSTNAME=matthews-mac-mini
OPENCLAW_HOST=192.168.1.152

# NEW: Master controller
MASTER_CONTROLLER_AGENT=skippy
```

---

## Phase 2: Clarification Routing System

### 2.1 Create Clarification API

**File:** `src/app/api/clarifications/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// GET - Get pending clarifications (for Skippy)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pending = searchParams.get('pending') === 'true';
  
  let query = 'SELECT * FROM clarification_queue';
  if (pending) {
    query += ' WHERE answered_at IS NULL ORDER BY created_at DESC';
  } else {
    query += ' ORDER BY created_at DESC LIMIT 50';
  }
  
  const result = await pg.query(query);
  return NextResponse.json(result.rows);
}

// POST - Create new clarification request (from agent)
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const id = uuidv4();
  const result = await pg.query(`
    INSERT INTO clarification_queue (
      id, task_id, from_agent, question, question_type, options
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    id,
    body.task_id,
    body.from_agent,
    body.question,
    body.question_type || 'multiple_choice',
    body.options ? JSON.stringify(body.options) : null
  ]);
  
  // Notify Skippy via agent_messages
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    body.from_agent,
    'skippy',
    `CLARIFICATION REQUEST for task ${body.task_id}:\n\n${body.question}\n\nReply with your answer or ESCALATE to Matt.`,
    body.task_id,
    'pending'
  ]);
  
  return NextResponse.json(result.rows[0], { status: 201 });
}
```

**File:** `src/app/api/clarifications/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// PATCH - Answer a clarification
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  
  const result = await pg.query(`
    UPDATE clarification_queue
    SET answer = $1, answered_by = $2, answered_at = NOW(),
        escalated = $3
    WHERE id = $4
    RETURNING *
  `, [
    body.answer,
    body.answered_by || 'skippy',
    body.escalated || false,
    id
  ]);
  
  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  // Notify the requesting agent
  const clarification = result.rows[0];
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'skippy',
    clarification.from_agent,
    `CLARIFICATION ANSWER: ${body.answer}`,
    clarification.task_id,
    'pending'
  ]);
  
  return NextResponse.json(result.rows[0]);
}
```

### 2.2 Update Planning Route to Use Clarifications

**File:** `src/app/api/tasks/[id]/planning/route.ts` (modifications)

```typescript
// Add after line 10:

import { Pool } from 'pg';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

const MASTER_CONTROLLER = process.env.MASTER_CONTROLLER_AGENT || 'skippy';

// In POST handler, after generating question:
// Instead of just returning, also insert to clarification_queue

async function routeQuestionToController(
  taskId: string,
  question: string,
  options: Array<{id: string, label: string}>
) {
  await pg.query(`
    INSERT INTO clarification_queue (
      task_id, from_agent, question, question_type, options
    ) VALUES ($1, $2, $3, $4, $5)
  `, [
    taskId,
    'mission-control',
    question,
    'multiple_choice',
    JSON.stringify(options)
  ]);
  
  // Notify Skippy
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'mission-control',
    MASTER_CONTROLLER,
    `CLARIFICATION REQUEST for task ${taskId}:\n\n${question}\n\nOptions: ${options.map(o => o.label).join(', ')}\n\nReply with CLARIFICATION ANSWER: [task-id] [answer]`,
    taskId,
    'pending'
  ]);
}
```

---

## Phase 3: Agent Remote Access

### 3.1 Create Agent API Endpoints

**File:** `src/app/api/agent/view-tasks/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// GET - View tasks (for remote agents)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');
  const status = searchParams.get('status');
  
  let query = 'SELECT * FROM mc_tasks WHERE 1=1';
  const params: any[] = [];
  
  if (agentId) {
    query += ' AND assigned_agent_id = $' + (params.length + 1);
    params.push(agentId);
  }
  
  if (status) {
    query += ' AND status = $' + (params.length + 1);
    params.push(status);
  }
  
  query += ' ORDER BY updated_at DESC LIMIT 100';
  
  const result = await pg.query(query, params);
  return NextResponse.json(result.rows);
}
```

**File:** `src/app/api/agent/report-progress/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// POST - Report task progress (from remote agent)
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const { task_id, agent_id, status, message, deliverables } = body;
  
  // Update task
  await pg.query(`
    UPDATE mc_tasks 
    SET status = $1, updated_at = NOW(), deliverables = $2
    WHERE id = $3
  `, [status, deliverables ? JSON.stringify(deliverables) : null, task_id]);
  
  // Log activity
  const activityId = uuidv4();
  await pg.query(`
    INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `, [activityId, task_id, agent_id, 'status_changed', message]);
  
  // Notify Mission Control (via agent_messages for sync)
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    agent_id,
    'mission-control',
    `TASK PROGRESS: ${task_id} is now ${status}. ${message}`,
    task_id,
    'pending'
  ]);
  
  return NextResponse.json({ success: true });
}
```

**File:** `src/app/api/agent/create-task/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// POST - Create task (from remote agent)
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const id = uuidv4();
  
  const result = await pg.query(`
    INSERT INTO mc_tasks (
      id, title, description, status, priority,
      assigned_agent_id, created_by_agent_id,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    RETURNING *
  `, [
    id,
    body.title,
    body.description,
    body.status || 'inbox',
    body.priority || 'normal',
    body.assigned_agent_id,
    body.created_by_agent_id
  ]);
  
  // Notify Mission Control to sync
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, status)
    VALUES ($1, $2, $3, $4)
  `, [
    body.created_by_agent_id,
    'mission-control',
    `NEW TASK CREATED: ${body.title} (ID: ${id})`,
    'pending'
  ]);
  
  return NextResponse.json(result.rows[0], { status: 201 });
}
```

---

## Phase 4: Multi-Machine Dispatch

### 4.1 Update Dispatch Logic

**File:** `src/app/api/tasks/[id]/dispatch/route.ts` (modifications)

```typescript
// Add at top:

import { Pool } from 'pg';

const pg = new Pool({ 
  connectionString: process.env.POSTGRES_URL 
});

// Replace the dispatch logic with:

export async function POST(request: NextRequest, { params }: RouteParams) {
  // ... existing task/agent retrieval ...

  // Check if agent is on a different machine
  const agentMachine = await pg.query(`
    SELECT machine_hostname, openclaw_url FROM mc_agents WHERE id = $1
  `, [agent.id]);
  
  const isRemoteAgent = agentMachine.rows.length > 0 && 
                        agentMachine.rows[0].machine_hostname !== process.env.MACHINE_HOSTNAME;

  if (isRemoteAgent) {
    // Route via PostgreSQL instead of direct WebSocket
    return await dispatchToRemoteAgent(task, agent, agentMachine.rows[0]);
  } else {
    // Local dispatch (existing logic)
    return await dispatchToLocalAgent(task, agent);
  }
}

async function dispatchToRemoteAgent(
  task: Task, 
  agent: Agent, 
  agentInfo: { machine_hostname: string; openclaw_url: string }
) {
  const taskMessage = buildTaskMessage(task);
  
  // Insert into agent_messages for remote agent to pick up
  await pg.query(`
    INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
    VALUES ($1, $2, $3, $4, $5)
  `, [
    'mission-control',
    agent.id,
    taskMessage,
    task.id,
    'pending'
  ]);
  
  // Update task status
  await pg.query(`
    UPDATE mc_tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1
  `, [task.id]);
  
  // Update agent status
  await pg.query(`
    UPDATE mc_agents SET status = 'working', updated_at = NOW() WHERE id = $1
  `, [agent.id]);
  
  return NextResponse.json({
    success: true,
    task_id: task.id,
    agent_id: agent.id,
    machine: agentInfo.machine_hostname,
    method: 'postgresql_routing'
  });
}

function buildTaskMessage(task: Task): string {
  const priorityEmoji = {
    low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴'
  }[task.priority] || '⚪';
  
  return `${priorityEmoji} **NEW TASK ASSIGNED**

**Title:** ${task.title}
${task.description ? `**Description:** ${task.description}\n` : ''}
**Priority:** ${task.priority.toUpperCase()}
**Task ID:** ${task.id}

When complete:
1. POST /api/agent/report-progress with status='review'
2. Reply with TASK_COMPLETE: [summary]`;
}
```

---

## Phase 5: Skippy Master Controller Integration

### 5.1 Add Skills for Skippy

**File:** `/Users/matt/clawd/skills/mission-control-master/SKILL.md`

```markdown
# Mission Control Master Controller

Skippy's role as the central orchestrator for the multi-agent system.

## Duties

1. **Monitor Clarification Queue**
2. **Answer or Escalate Questions**
3. **Monitor Task Health**
4. **Broadcast Announcements**

## Commands

### Check Pending Clarifications

\`\`\`sql
SELECT c.*, t.title as task_title
FROM clarification_queue c
LEFT JOIN mc_tasks t ON c.task_id = t.id
WHERE c.answered_at IS NULL
ORDER BY c.created_at;
\`\`\`

### Answer a Clarification

\`\`\`sql
-- If you can answer
UPDATE clarification_queue
SET answer = 'Your answer here',
    answered_by = 'skippy',
    answered_at = NOW()
WHERE id = '[clarification-id]';

-- Notify the requesting agent
INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status)
VALUES ('skippy', '[from_agent]', 'CLARIFICATION ANSWER: Your answer here', '[task_id]', 'pending');
\`\`\`

### Escalate to Matt

\`\`\`sql
UPDATE clarification_queue
SET escalated = TRUE,
    answered_by = 'matt'
WHERE id = '[clarification-id]';
\`\`\`

Then send Telegram message to Matt with the question.

### Monitor Stuck Tasks

\`\`\`sql
SELECT * FROM mc_tasks
WHERE status NOT IN ('done', 'cancelled')
AND updated_at < NOW() - INTERVAL '1 hour'
ORDER BY updated_at;
\`\`\`

### Broadcast to All Agents

\`\`\`sql
INSERT INTO agent_messages (from_agent, to_agent, content, status)
VALUES 
  ('skippy', 'dev-manager', 'ANNOUNCEMENT: ...', 'pending'),
  ('skippy', 'insights-manager', 'ANNOUNCEMENT: ...', 'pending'),
  ('skippy', 'marketing-manager', 'ANNOUNCEMENT: ...', 'pending');
\`\`\`

## Crontab Entry

Add to Skippy's crontab for periodic monitoring:

\`\`\`bash
# Check clarifications every minute
* * * * * psql "$POSTGRES_URL" -c "SELECT id, from_agent, substring(question, 1, 100) FROM clarification_queue WHERE answered_at IS NULL;" | if grep -q "rows"; then /path/to/process-clarifications.sh; fi
\`\`\`
```

### 5.2 Update Skippy's Poll Script

**File:** `/Users/matt/clawd/agents/simplified-protocol/poll-messages.sh`

Add clarification handling:

```bash
# After processing agent_messages, also check clarifications

CLARIFICATIONS=$($PSQL "$DATABASE_URL" -t -c "SELECT id, from_agent, question FROM clarification_queue WHERE answered_at IS NULL ORDER BY created_at LIMIT 1;" 2>/dev/null)

if [ -n "$CLARIFICATIONS" ]; then
    echo "[$(date -Iseconds)] [$AGENT_ID] Found pending clarification"
    # Trigger webhook with clarification context
    JSON_PAYLOAD=$(cat <<EOF
{
  "text": "CLARIFICATION PENDING: A clarification request is waiting for your answer. Check clarification_queue table.",
  "mode": "now"
}
EOF
)
    
    $CURL -s -X POST "$WEBHOOK_URL" \
        -H "Authorization: Bearer $WEBHOOK_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD"
fi
```

---

## Phase 6: Remote Agent Skills

### 6.1 Add Skills to Each Agent

**File:** `~/skills/mission-control-agent/SKILL.md` (on each agent machine)

```markdown
# Mission Control Agent Integration

Access the Mission Control dashboard from your agent session.

## View Tasks

\`\`\`bash
psql "$POSTGRES_URL" -c "SELECT id, title, status, priority FROM mc_tasks WHERE assigned_agent_id = 'YOUR_AGENT_ID' ORDER BY updated_at DESC;"
\`\`\`

## View All Tasks

\`\`\`bash
psql "$POSTGRES_URL" -c "SELECT id, title, status, assigned_agent_id FROM mc_tasks ORDER BY updated_at DESC LIMIT 20;"
\`\`\`

## Request Clarification

\`\`\`sql
INSERT INTO clarification_queue (task_id, from_agent, question, question_type, options)
VALUES (
  'task-id',
  'YOUR_AGENT_ID',
  'What is the preferred approach?',
  'multiple_choice',
  '[{"id":"A","label":"Option 1"},{"id":"B","label":"Option 2"}]'::jsonb
);
\`\`\`

## Report Progress

\`\`\`bash
curl -X POST http://192.168.1.152:4000/api/agent/report-progress \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-id",
    "agent_id": "YOUR_AGENT_ID",
    "status": "in_progress",
    "message": "Working on feature X"
  }'
\`\`\`

## Create Task

\`\`\`bash
curl -X POST http://192.168.1.152:4000/api/agent/create-task \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New Task Title",
    "description": "Task description",
    "assigned_agent_id": "target-agent-id",
    "created_by_agent_id": "YOUR_AGENT_ID"
  }'
\`\`\`

## Complete Task

\`\`\`bash
curl -X POST http://192.168.1.152:4000/api/agent/report-progress \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "task-id",
    "agent_id": "YOUR_AGENT_ID",
    "status": "done",
    "message": "Task completed successfully",
    "deliverables": [{"type": "file", "path": "/path/to/file"}]
  }'
\`\`\`

## Environment Variables Required

\`\`\`bash
export POSTGRES_URL="postgresql://..."
export MISSION_CONTROL_URL="http://192.168.1.152:4000"
\`\`\`
```

---

## Phase 7: Network & Security

### 7.1 Local Network Configuration

Mission Control should be accessible on the local network:

```bash
# Update next.config.mjs
const nextConfig = {
  // ... existing config
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:4000', '192.168.1.152:4000'],
    },
  },
};
```

### 7.2 API Token for Agent Access

Generate a token for agent API access:

```bash
openssl rand -hex 32
```

Add to `.env.local`:
```bash
MC_AGENT_API_TOKEN=your-generated-token
```

Update middleware to allow agent access:
```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow agent API endpoints with token
  if (pathname.startsWith('/api/agent/')) {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (token === process.env.MC_AGENT_API_TOKEN) {
      return NextResponse.next();
    }
  }
  
  // ... rest of middleware
}
```

### 7.3 Tailscale for Remote Access (Optional)

If agents need access outside the local network:

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up

# Update environment
OPENCLAW_GATEWAY_URL=wss://matthews-mac-mini.tailnet-name.ts.net:18789
MISSION_CONTROL_URL=http://matthews-mac-mini.tailnet-name.ts.net:4000
```

---

## Phase 8: Testing Checklist

### 8.1 Database Sync

- [ ] PostgreSQL tables created
- [ ] Sync service running
- [ ] Tasks appear in mc_tasks
- [ ] Agents appear in mc_agents

### 8.2 Clarification Routing

- [ ] Agent creates clarification
- [ ] Skippy receives notification
- [ ] Skippy can answer
- [ ] Answer routed back to agent

### 8.3 Remote Dispatch

- [ ] Task assigned to remote agent
- [ ] Message appears in agent_messages
- [ ] Remote agent wakes and processes
- [ ] Status updates in mc_tasks

### 8.4 Agent Access

- [ ] Agent can view tasks via PostgreSQL
- [ ] Agent can report progress via API
- [ ] Agent can create tasks via API

---

## Deployment Order

1. **Deploy PostgreSQL tables** (Phase 1.1)
2. **Update Mission Control env** (Phase 1.3)
3. **Add sync service** (Phase 1.2)
4. **Create clarification APIs** (Phase 2)
5. **Create agent APIs** (Phase 3)
6. **Update dispatch logic** (Phase 4)
7. **Add Skippy skills** (Phase 5)
8. **Add agent skills** (Phase 6)
9. **Configure network** (Phase 7)
10. **Run tests** (Phase 8)

---

## Rollback Plan

If issues arise:

1. **Disable sync service** - Comment out `startSyncService()` call
2. **Revert dispatch** - Use original dispatch logic
3. **Remove clarification routing** - Questions go direct to user
4. **SQLite remains source of truth** - PostgreSQL tables are secondary

---

## Future Enhancements

1. **Bidirectional Sync** - PostgreSQL → SQLite for offline support
2. **Task Dependencies** - Tasks that depend on other tasks
3. **Agent Workload Balancing** - Distribute tasks based on agent capacity
4. **Time Tracking** - Track time spent per task
5. **Cost Tracking** - Track AI costs per task/agent
