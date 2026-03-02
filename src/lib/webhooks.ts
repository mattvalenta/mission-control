/**
 * Webhook Service
 * 
 * Outbound webhook system for integrating with external systems.
 * Events trigger webhooks with retry logic and HMAC signing.
 */

import crypto from 'crypto';
import { queryOne, queryAll, run } from './db';
import { notifyBoth } from './db/notify-wrapper';

// Webhook types
export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  max_attempts: number;
  last_attempt: Date | null;
  next_retry: Date | null;
  response_code: number | null;
  response_body: string | null;
  error: string | null;
  created_at: Date;
}

// Standard webhook events
export const WebhookEvents = {
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_STATUS_CHANGED: 'task.status_changed',
  AGENT_STATUS_CHANGED: 'agent.status_changed',
  DLQ_ITEM_ADDED: 'dlq.item_added',
  REVIEW_SUBMITTED: 'review.submitted',
  JOB_FAILED: 'job.failed',
} as const;

/**
 * Fire webhooks for an event
 */
export async function fireWebhooks(eventType: string, payload: Record<string, any>): Promise<void> {
  // Get enabled webhooks that subscribe to this event
  const webhooks = await queryAll<Webhook>(
    `SELECT * FROM webhooks WHERE enabled = true AND events ? $1`,
    [eventType]
  );

  if (webhooks.length === 0) {
    return; // No webhooks configured for this event
  }

  // Queue delivery for each webhook
  for (const webhook of webhooks) {
    await queueDelivery(webhook, eventType, payload);
  }
}

/**
 * Queue a webhook delivery
 */
async function queueDelivery(
  webhook: Webhook,
  eventType: string,
  payload: Record<string, any>
): Promise<string> {
  const result = await queryOne<{ id: string }>(
    `INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status, created_at)
     VALUES ($1, $2, $3, 'pending', NOW())
     RETURNING id`,
    [webhook.id, eventType, JSON.stringify(payload)]
  );

  // Notify delivery processor
  await notifyBoth('webhooks', 'delivery_queued', {
    deliveryId: result?.id,
    webhookId: webhook.id,
    eventType,
  });

  return result?.id || '';
}

/**
 * Process a webhook delivery
 */
export async function processDelivery(deliveryId: string): Promise<boolean> {
  const delivery = await queryOne<WebhookDelivery & { url: string; secret: string | null }>(
    `SELECT d.*, w.url, w.secret 
     FROM webhook_deliveries d
     JOIN webhooks w ON d.webhook_id = w.id
     WHERE d.id = $1`,
    [deliveryId]
  );

  if (!delivery) {
    return false;
  }

  // Generate HMAC signature
  const payloadStr = JSON.stringify(delivery.payload);
  const signature = delivery.secret
    ? crypto
        .createHmac('sha256', delivery.secret)
        .update(payloadStr)
        .digest('hex')
    : '';

  try {
    const response = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MC-Signature': `sha256=${signature}`,
        'X-MC-Event': delivery.event_type,
        'X-MC-Delivery': deliveryId,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const responseBody = await response.text().catch(() => '');

    if (response.ok) {
      // Success
      await run(
        `UPDATE webhook_deliveries 
         SET status = 'sent', 
             last_attempt = NOW(), 
             response_code = $1, 
             response_body = $2,
             attempts = attempts + 1
         WHERE id = $3`,
        [response.status, responseBody.slice(0, 1000), deliveryId]
      );

      return true;
    } else {
      // HTTP error - retry
      await handleDeliveryFailure(deliveryId, `HTTP ${response.status}`, delivery.attempts);
      return false;
    }
  } catch (err) {
    // Network error - retry
    await handleDeliveryFailure(deliveryId, String(err), delivery.attempts);
    return false;
  }
}

/**
 * Handle delivery failure with retry logic
 */
async function handleDeliveryFailure(
  deliveryId: string,
  error: string,
  currentAttempts: number
): Promise<void> {
  const attempts = currentAttempts + 1;
  const maxAttempts = 3;

  if (attempts >= maxAttempts) {
    // Max attempts reached - mark as failed
    await run(
      `UPDATE webhook_deliveries 
       SET status = 'failed', 
           last_attempt = NOW(), 
           error = $1, 
           attempts = $2
       WHERE id = $3`,
      [error, attempts, deliveryId]
    );
  } else {
    // Retry with exponential backoff
    const retryDelays = [1, 5, 15]; // minutes
    const delayMinutes = retryDelays[attempts - 1] || 15;
    const nextRetry = new Date(Date.now() + delayMinutes * 60 * 1000);

    await run(
      `UPDATE webhook_deliveries 
       SET status = 'retrying', 
           last_attempt = NOW(), 
           error = $1, 
           attempts = $2,
           next_retry = $3
       WHERE id = $4`,
      [error, attempts, nextRetry, deliveryId]
    );
  }
}

/**
 * Process all pending deliveries
 */
export async function processPendingDeliveries(): Promise<number> {
  // Get pending deliveries or those ready for retry
  const deliveries = await queryAll<{ id: string }>(
    `SELECT id FROM webhook_deliveries 
     WHERE status IN ('pending', 'retrying')
       AND (next_retry IS NULL OR next_retry <= NOW())
     ORDER BY created_at ASC
     LIMIT 10`
  );

  let processed = 0;

  for (const delivery of deliveries) {
    const success = await processDelivery(delivery.id);
    if (success) processed++;
  }

  return processed;
}

/**
 * Create a webhook
 */
export async function createWebhook(data: {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  enabled?: boolean;
}): Promise<Webhook> {
  const result = await queryOne<Webhook>(
    `INSERT INTO webhooks (name, url, secret, events, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     RETURNING *`,
    [data.name, data.url, data.secret || null, JSON.stringify(data.events), data.enabled ?? true]
  );

  return result!;
}

/**
 * Update a webhook
 */
export async function updateWebhook(
  id: string,
  data: Partial<{
    name: string;
    url: string;
    secret: string;
    events: string[];
    enabled: boolean;
  }>
): Promise<Webhook | null> {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }

  if (data.url !== undefined) {
    updates.push(`url = $${paramIndex++}`);
    values.push(data.url);
  }

  if (data.secret !== undefined) {
    updates.push(`secret = $${paramIndex++}`);
    values.push(data.secret);
  }

  if (data.events !== undefined) {
    updates.push(`events = $${paramIndex++}`);
    values.push(JSON.stringify(data.events));
  }

  if (data.enabled !== undefined) {
    updates.push(`enabled = $${paramIndex++}`);
    values.push(data.enabled);
  }

  if (updates.length === 0) {
    return null;
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await queryOne<Webhook>(
    `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  return result;
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(id: string): Promise<boolean> {
  const result = await run('DELETE FROM webhooks WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get all webhooks
 */
export async function getWebhooks(): Promise<Webhook[]> {
  return queryAll<Webhook>('SELECT * FROM webhooks ORDER BY created_at DESC');
}

/**
 * Get webhook by ID
 */
export async function getWebhook(id: string): Promise<Webhook | null> {
  return queryOne<Webhook>('SELECT * FROM webhooks WHERE id = $1', [id]);
}

/**
 * Get delivery history
 */
export async function getDeliveryHistory(
  webhookId?: string,
  limit = 50
): Promise<WebhookDelivery[]> {
  if (webhookId) {
    return queryAll<WebhookDelivery>(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [webhookId, limit]
    );
  }

  return queryAll<WebhookDelivery>(
    `SELECT * FROM webhook_deliveries ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
}

/**
 * Test a webhook
 */
export async function testWebhook(webhookId: string): Promise<{
  success: boolean;
  responseCode?: number;
  error?: string;
}> {
  const webhook = await getWebhook(webhookId);

  if (!webhook) {
    return { success: false, error: 'Webhook not found' };
  }

  // Create test delivery
  const deliveryId = await queueDelivery(webhook, 'webhook.test', {
    message: 'This is a test webhook from Mission Control',
    timestamp: new Date().toISOString(),
  });

  // Process immediately
  const success = await processDelivery(deliveryId);

  if (success) {
    const delivery = await queryOne<{ response_code: number }>(
      'SELECT response_code FROM webhook_deliveries WHERE id = $1',
      [deliveryId]
    );

    return { success: true, responseCode: delivery?.response_code };
  } else {
    const delivery = await queryOne<{ error: string }>(
      'SELECT error FROM webhook_deliveries WHERE id = $1',
      [deliveryId]
    );

    return { success: false, error: delivery?.error };
  }
}
