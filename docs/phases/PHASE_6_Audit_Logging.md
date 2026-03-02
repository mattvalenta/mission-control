# Phase 6: Audit Logging

**Duration:** 0.5 Weeks (3 days)  
**Priority:** 🔴 High  
**Risk Level:** Low  
**Dependencies:** Phase 1 (PostgreSQL Migration)

---

## Objective

Implement comprehensive audit logging for security forensics, compliance, and debugging. Track all significant actions with actor, target, and context.

---

## Success Criteria

- [ ] All security events logged
- [ ] All CRUD operations logged
- [ ] Logs searchable by action, actor, date
- [ ] Retention policy enforced (90 days)
- [ ] Admin UI for viewing logs

---

## Day 1: Schema & API

### Tasks

#### 1.1 Create Audit Log Schema
```sql
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
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);
```

#### 1.2 Create Audit Helper
```typescript
// src/lib/audit.ts
export async function logAuditEvent(event: {
  action: string;
  actor: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  detail?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  await run(
    `INSERT INTO audit_log (action, actor, actor_id, actor_instance, target_type, target_id, detail, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.action,
      event.actor,
      event.actorId || null,
      process.env.MC_INSTANCE_ID || 'unknown',
      event.targetType || null,
      event.targetId || null,
      event.detail ? JSON.stringify(event.detail) : null,
      event.ipAddress || null,
      event.userAgent || null
    ]
  );
}
```

#### 1.3 Create API Endpoints
- [ ] `GET /api/audit` - List logs with filters
- [ ] `GET /api/audit/security` - Security-specific events

---

## Day 2: Integration

### Tasks

#### 2.1 Add Logging to Key Actions

| Action | When | Detail |
|--------|------|--------|
| `task_created` | Task created | `{ title, priority }` |
| `task_dispatched` | Task sent to agent | `{ agentId }` |
| `task_completed` | Task marked done | `{ summary }` |
| `agent_created` | Agent registered | `{ role, tier }` |
| `agent_status_changed` | Agent status update | `{ oldStatus, newStatus }` |
| `review_submitted` | Quality review | `{ status, notes }` |
| `settings_changed` | Config updated | `{ key, oldValue, newValue }` |

#### 2.2 Add Request Middleware
- [ ] Extract IP address from headers
- [ ] Extract user agent
- [ ] Attach to audit events

---

## Day 3: UI & Retention

### Tasks

#### 3.1 Create Audit Log Viewer
- [ ] Create `src/components/AuditLogViewer.tsx`
- [ ] Filter by action type
- [ ] Filter by actor
- [ ] Filter by date range
- [ ] Search in details

#### 3.2 Add Retention Job
- [ ] Add to scheduled_jobs
- [ ] Delete logs older than 90 days

```typescript
handlers['cleanup-old-audit-logs'] = async () => {
  await run(
    `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
  );
};
```

---

## Tracked Actions

### Security Events
- `login`, `logout`, `login_failed`
- `api_key_generated`, `api_key_revoked`
- `settings_changed`

### Task Events
- `task_created`, `task_updated`, `task_deleted`
- `task_dispatched`, `task_completed`
- `review_submitted`

### Agent Events
- `agent_created`, `agent_updated`, `agent_deleted`
- `agent_status_changed`

### System Events
- `instance_started`, `instance_shutdown`
- `job_completed`, `job_failed`
- `dlq_item_added`

---

## Files Changed

### New Files
- `src/lib/audit.ts`
- `src/app/api/audit/route.ts`
- `src/components/AuditLogViewer.tsx`
- `migrations/008_audit_log.sql`

### Modified Files
- All API routes (add logAuditEvent calls)
- `src/middleware.ts` (extract IP/user-agent)

---

## Sign-Off

- [ ] Schema created
- [ ] Logging integrated
- [ ] UI complete
- [ ] Retention working

**Approved by:** ________________  
**Date:** ________________
