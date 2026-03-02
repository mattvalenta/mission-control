# Phase 7: Outbound Webhooks

**Duration:** 1 Week  
**Priority:** 🟡 Medium  
**Risk Level:** Medium  
**Dependencies:** Phase 1 (PostgreSQL Migration), Phase 2 (LISTEN/NOTIFY)

---

## Objective

Implement outbound webhook system for integrating with external systems (Slack, email, custom handlers). Events trigger webhooks with retry logic.

---

## Success Criteria

- [ ] Webhooks fire on configured events
- [ ] Retry logic works (exponential backoff)
- [ ] HMAC signature for verification
- [ ] Delivery history visible
- [ ] Management UI complete

---

## Day 1-2: Schema & API

### Tasks

#### 1.1 Create Webhook Schema
```sql
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
```

#### 1.2 Create API Endpoints
- [ ] `GET /api/webhooks` - List webhooks
- [ ] `POST /api/webhooks` - Create webhook
- [ ] `PATCH /api/webhooks/:id` - Update webhook
- [ ] `DELETE /api/webhooks/:id` - Delete webhook
- [ ] `GET /api/webhooks/deliveries` - Delivery history
- [ ] `POST /api/webhooks/:id/test` - Test webhook

---

## Day 3-4: Delivery System

### Tasks

#### 2.1 Create Webhook Service
```typescript
// src/lib/webhooks.ts
import crypto from 'crypto';

export async function fireWebhooks(eventType: string, payload: any) {
  const webhooks = await queryAll<Webhook>(
    `SELECT * FROM webhooks WHERE enabled = true AND events ? $1`,
    [eventType]
  );
  
  for (const webhook of webhooks) {
    await queueDelivery(webhook, eventType, payload);
  }
}

async function queueDelivery(webhook: Webhook, eventType: string, payload: any) {
  await run(
    `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status)
     VALUES ($1, $2, $3, 'pending')`,
    [webhook.id, eventType, JSON.stringify(payload)]
  );
  
  // Notify delivery processor
  await broadcastNotification('webhook_delivery', 'new', { webhookId: webhook.id });
}

export async function processDelivery(deliveryId: string) {
  const delivery = await queryOne<WebhookDelivery>(
    `SELECT d.*, w.url, w.secret FROM webhook_deliveries d
     JOIN webhooks w ON d.webhook_id = w.id
     WHERE d.id = $1`,
    [deliveryId]
  );
  
  if (!delivery) return;
  
  const signature = crypto
    .createHmac('sha256', delivery.secret || '')
    .update(JSON.stringify(delivery.payload))
    .digest('hex');
  
  try {
    const response = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MC-Signature': `sha256=${signature}`,
        'X-MC-Event': delivery.event_type
      },
      body: JSON.stringify(delivery.payload)
    });
    
    await run(
      `UPDATE webhook_deliveries 
       SET status = 'sent', last_attempt = NOW(), response_code = $1, attempts = attempts + 1
       WHERE id = $2`,
      [response.status, deliveryId]
    );
  } catch (err) {
    const attempts = delivery.attempts + 1;
    const status = attempts >= delivery.max_attempts ? 'failed' : 'retrying';
    
    await run(
      `UPDATE webhook_deliveries 
       SET status = $1, last_attempt = NOW(), error = $2, attempts = $3
       WHERE id = $4`,
      [status, String(err), attempts, deliveryId]
    );
  }
}
```

#### 2.2 Create Retry Processor
- [ ] Process pending deliveries every minute
- [ ] Exponential backoff: 1m, 5m, 15m
- [ ] Max 3 attempts

#### 2.3 Integrate with Events
- [ ] Task events → fireWebhooks
- [ ] Agent events → fireWebhooks
- [ ] DLQ events → fireWebhooks

---

## Day 5: UI & Testing

### Tasks

#### 3.1 Create Webhook Management UI
- [ ] Create `src/components/WebhookManager.tsx`
- [ ] List webhooks
- [ ] Create/Edit form
- [ ] Test button
- [ ] Delivery history

#### 3.2 Testing
- [ ] Webhook fires on event
- [ ] Retry works
- [ ] HMAC signature valid
- [ ] UI functional

---

## Supported Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `task.created` | New task | `{ task }` |
| `task.completed` | Task done | `{ task, summary }` |
| `task.failed` | Task failed | `{ task, error }` |
| `agent.status_changed` | Agent status | `{ agent, oldStatus, newStatus }` |
| `dlq.item_added` | Job to DLQ | `{ jobName, error }` |
| `review.submitted` | Quality review | `{ task, review }` |

---

## Files Changed

### New Files
- `src/lib/webhooks.ts`
- `src/app/api/webhooks/route.ts`
- `src/app/api/webhooks/[id]/route.ts`
- `src/app/api/webhooks/[id]/test/route.ts`
- `src/app/api/webhooks/deliveries/route.ts`
- `src/components/WebhookManager.tsx`
- `migrations/009_webhooks.sql`

### Modified Files
- `src/app/api/tasks/route.ts` - Add webhook triggers
- `src/app/api/tasks/[id]/route.ts` - Add webhook triggers
- `src/lib/scheduler.ts` - Add DLQ webhook

---

## Sign-Off

- [ ] Webhooks firing
- [ ] Retry working
- [ ] HMAC working
- [ ] UI complete

**Approved by:** ________________  
**Date:** ________________
