# Phase 2: LISTEN/NOTIFY Integration

**Duration:** 1 Week  
**Priority:** 🔴 High  
**Risk Level:** Medium  
**Dependencies:** Phase 1 (PostgreSQL Migration)

---

## Objective

Implement PostgreSQL LISTEN/NOTIFY for real-time synchronization across Mission Control instances. This eliminates polling and enables instant updates when any instance modifies shared state.

---

## Success Criteria

- [ ] All MC instances receive real-time updates
- [ ] Latency < 100ms for cross-instance updates
- [ ] Automatic reconnection on connection drop
- [ ] Hybrid fallback works when notifications missed
- [ ] No duplicate notifications processed

---

## Day 1-2: Core Infrastructure

### Tasks

#### 1.1 Create Notification Module
- [ ] Create `src/lib/db/notify.ts`
- [ ] Define notification channels
- [ ] Implement broadcast function
- [ ] Implement listener service

**Deliverable:** `src/lib/db/notify.ts`

```typescript
// Key exports:
export type NotificationChannel = 
  | 'task_updates' 
  | 'agent_updates' 
  | 'activity_updates'
  | 'deliverable_updates'
  | 'job_available'
  | 'alerts';

export function broadcastNotification(channel, type, data): Promise<void>
export function startNotificationListener(callback): Promise<void>
export function setupHybridSync(onUpdate): void
```

#### 1.2 Handle Payload Size Limit
- [ ] Detect payloads > 7KB
- [ ] Store large payloads in notification_payloads table
- [ ] Send reference ID instead of full payload
- [ ] Implement fetch-on-receive

```sql
-- For large payloads
CREATE TABLE notification_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Auto-cleanup after 1 hour
CREATE INDEX idx_notification_payloads_created 
  ON notification_payloads(created_at) 
  WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Day 3-4: Integration

### Tasks

#### 2.1 Add Broadcast Calls to API Routes
- [ ] Task creation → `task_updates`
- [ ] Task updates → `task_updates`
- [ ] Task deletion → `task_updates`
- [ ] Agent status changes → `agent_updates`
- [ ] Activity logging → `activity_updates`
- [ ] Deliverable creation → `deliverable_updates`

**Pattern:**
```typescript
// After any mutation
await broadcastNotification('task_updates', 'task_created', { 
  taskId: task.id,
  task: task 
});
```

#### 2.2 Create React Hooks
- [ ] Create `src/hooks/useNotifications.ts`
- [ ] Integrate with Zustand store
- [ ] Handle reconnection state

```typescript
// Usage
useNotifications(); // Auto-subscribes on mount
```

#### 2.3 Add Database Triggers (Optional)
- [ ] Create automatic notification triggers
- [ ] Test trigger performance

```sql
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('task_updates', json_build_object(
    'type', 'task_updated',
    'taskId', NEW.id,
    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_notify AFTER UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_task_change();
```

---

## Day 5: Hybrid Fallback

### Tasks

#### 3.1 Implement Poll Fallback
- [ ] Track last notification timestamp
- [ ] Poll if no notification for 30 seconds
- [ ] Fetch changes since last sync
- [ ] Merge with notification updates

```typescript
const NOTIFY_TIMEOUT = 30000; // 30 seconds

export function setupHybridSync(onUpdate: (changes: any[]) => void) {
  let lastNotification = Date.now();
  
  // Listen for real-time updates
  startNotificationListener((channel, payload) => {
    lastNotification = Date.now();
    onUpdate([payload]);
  });
  
  // Fallback poll if no notification for 30s
  setInterval(async () => {
    if (Date.now() - lastNotification > NOTIFY_TIMEOUT) {
      const changes = await fetchChangesSince(lastNotification);
      if (changes.length > 0) onUpdate(changes);
    }
  }, NOTIFY_TIMEOUT);
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Broadcast function works
- [ ] Listener receives notifications
- [ ] Large payload handling
- [ ] Reconnection logic

### Integration Tests
- [ ] Two instances sync on task creation
- [ ] Two instances sync on task update
- [ ] Agent status syncs across instances
- [ ] Activity log syncs across instances

### Failure Tests
- [ ] Connection drop recovery
- [ ] Missed notification recovery (poll fallback)
- [ ] Duplicate detection

### Performance Tests
- [ ] Latency < 100ms
- [ ] 100 notifications/second handled
- [ ] Memory usage stable over time

---

## Files Changed

### New Files
- `src/lib/db/notify.ts`
- `src/hooks/useNotifications.ts`
- `migrations/004_notification_payloads.sql`

### Modified Files
- `src/app/api/tasks/route.ts` - Add broadcast
- `src/app/api/tasks/[id]/route.ts` - Add broadcast
- `src/app/api/agents/route.ts` - Add broadcast
- `src/lib/store.ts` - Add notification handling
- `src/app/layout.tsx` - Initialize listener

---

## Notification Channels

| Channel | When Fired | Payload |
|---------|------------|---------|
| `task_updates` | Task created/updated/deleted | `{ type, taskId, task? }` |
| `agent_updates` | Agent status changed | `{ type, agentId, status }` |
| `activity_updates` | Activity logged | `{ taskId, activity }` |
| `deliverable_updates` | Deliverable added | `{ taskId, deliverable }` |
| `job_available` | Job ready to run | `{ jobName }` |
| `alerts` | DLQ item, critical error | `{ type, details }` |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| 8KB payload limit | Send ID + fetch pattern |
| Connection drops | Auto-reconnect logic |
| Missed notifications | Hybrid poll fallback |
| Duplicate processing | Track processed IDs |
| Memory leak | Cleanup old notification IDs |

---

## Sign-Off

- [ ] Real-time sync working
- [ ] Reconnection tested
- [ ] Fallback tested
- [ ] Performance acceptable

**Approved by:** ________________  
**Date:** ________________
