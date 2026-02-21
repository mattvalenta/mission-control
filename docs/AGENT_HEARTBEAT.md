# Agent Heartbeat Protocol

## Overview

Each agent runs a heartbeat check every 30 minutes. The heartbeat:

1. **Checks for pending tasks** - Tasks assigned but not started
2. **Checks for in-progress tasks** - Tasks currently being worked on
3. **Prioritizes work** - In-progress tasks first, then pending by priority

## Heartbeat Checklist

Every heartbeat, the agent should:

### 1. Check Mission Control API

```bash
curl -s "${MISSION_CONTROL_URL}/api/agents/${AGENT_ID}/tasks"
```

Response includes:
```json
{
  "count": 2,
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Task title",
      "status": "assigned",
      "priority": "high",
      "planning_stage": "complete",
      "optimized_description": "..."
    }
  ]
}
```

### 2. Prioritize Tasks

**Priority Order:**
1. **In-progress tasks** - Resume these first
2. **High priority pending** - Start these next
3. **Normal priority pending** - Queue these
4. **Low priority pending** - Only if no other work

**Priority Field Values:**
- `urgent` - Drop everything and handle
- `high` - Start within the hour
- `medium` - Start within the day
- `low` - Backlog, handle when free

### 3. Task Status Flow

```
assigned → in_progress → review → done
              ↓
           blocked (if stuck)
```

### 4. Update Status

When starting work:
```bash
curl -X POST "${MISSION_CONTROL_URL}/api/agents/${AGENT_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '{"action":"update","task_id":"...","status":"in_progress","message":"Starting work"}'
```

When completing:
```bash
curl -X POST "${MISSION_CONTROL_URL}/api/agents/${AGENT_ID}/tasks" \
  -H "Content-Type: application/json" \
  -d '{"action":"complete","task_id":"...","message":"TASK_COMPLETE: What I did"}'
```

## Agent HEARTBEAT.md Template

Each agent should have a `HEARTBEAT.md` in their workspace:

```markdown
# HEARTBEAT.md - [Agent Name]

## Heartbeat Tasks

1. **Check for pending tasks**
   - Query Mission Control API
   - Report any new assignments

2. **Check for in-progress tasks**
   - Resume work on active tasks
   - Report progress

3. **Check for blocked tasks**
   - Escalate blockers to Skippy

4. **Update status**
   - Set agent status based on current work

## Priority Queue

| Priority | Task ID | Title | Status |
|----------|---------|-------|--------|
| 1 | ... | In-progress task | in_progress |
| 2 | ... | High priority pending | assigned |
| 3 | ... | Normal pending | assigned |

## If Nothing Needs Attention

Reply with: HEARTBEAT_OK
```

## Notification Flow

When a task is assigned to an agent:

1. **Mission Control** calls `/api/tasks/[id]/planning/transition`
2. **API returns** Discord notification payload
3. **Skippy** sends Discord message to agent's channel with mention
4. **Agent** sees notification on next heartbeat or immediately

## Discord Integration

**Agent Channels:**
- Dev Manager: `1473425570422460449`
- Marketing Manager: `1473425604325019648`
- Insights Manager: `1473425629822058618`

**Notification Format:**
```
<@USER_ID> 🔔 **NEW TASK ASSIGNED**

**Title:** [Task title]
**Status:** planning
**Stage:** agent_planning
**Task ID:** [uuid]

[Message]

**Mission Control:** [URL]
```

## Cron Configuration

Agents can set up cron jobs for heartbeat checks:

```bash
# Every 30 minutes
*/30 * * * * /path/to/agent-heartbeat.sh >> /tmp/agent-heartbeat.log 2>&1
```

Or use OpenClaw's cron system:

```json
{
  "name": "agent-heartbeat",
  "schedule": { "kind": "every", "everyMs": 1800000 },
  "payload": { "kind": "agentTurn", "message": "HEARTBEAT" },
  "sessionTarget": "isolated"
}
```
