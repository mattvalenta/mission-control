/**
 * PostgreSQL LISTEN/NOTIFY Module for Mission Control
 * 
 * Provides real-time synchronization across MC instances using
 * PostgreSQL's built-in pub/sub system.
 * 
 * Features:
 * - Type-safe notification channels
 * - Automatic reconnection
 * - Large payload handling (> 8KB)
 * - Hybrid poll fallback
 */

import pg, { Pool, PoolClient } from 'pg';

const { Pool: PgPool } = pg;

// Notification channels
export type NotificationChannel =
  | 'task_updates'
  | 'agent_updates'
  | 'activity_updates'
  | 'deliverable_updates'
  | 'job_available'
  | 'alerts';

// Notification types
export type NotificationType =
  | 'task_created'
  | 'task_updated'
  | 'task_deleted'
  | 'agent_status_changed'
  | 'activity_logged'
  | 'deliverable_added'
  | 'job_ready'
  | 'alert_dlq'
  | 'alert_error';

// Notification payload
export interface NotificationPayload {
  type: NotificationType;
  instanceId?: string;
  timestamp: number;
  data: Record<string, any>;
}

// Notification callback
export type NotificationCallback = (
  channel: NotificationChannel,
  payload: NotificationPayload
) => void;

// Configuration
const RECONNECT_DELAY_MS = 5000;
const PAYLOAD_SIZE_LIMIT = 7000; // 7KB (safe margin from 8KB limit)
const HYBRID_POLL_INTERVAL_MS = 30000; // 30 seconds

let listenerClient: PoolClient | null = null;
let isReconnecting = false;
let lastNotificationTime = Date.now();
let processedIds = new Set<string>();
const MAX_PROCESSED_IDS = 1000;

/**
 * Get the PostgreSQL pool for notifications
 */
function getNotificationPool(): Pool {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  return new PgPool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2, // Dedicated pool for notifications
  });
}

/**
 * Broadcast a notification to all listeners
 */
export async function broadcastNotification(
  channel: NotificationChannel,
  type: NotificationType,
  data: Record<string, any>,
  instanceId?: string
): Promise<void> {
  const pool = getNotificationPool();

  try {
    const payload: NotificationPayload = {
      type,
      instanceId: instanceId || process.env.MC_INSTANCE_ID || 'unknown',
      timestamp: Date.now(),
      data,
    };

    let payloadStr = JSON.stringify(payload);

    // Check payload size
    if (payloadStr.length > PAYLOAD_SIZE_LIMIT) {
      // Store large payload and send reference
      const payloadId = await storeLargePayload(pool, payload);
      payloadStr = JSON.stringify({
        type,
        instanceId: payload.instanceId,
        timestamp: payload.timestamp,
        data: { payloadId, truncated: true },
      });
    }

    // Broadcast notification
    await pool.query('SELECT pg_notify($1, $2)', [channel, payloadStr]);

    console.log(`[NOTIFY] Broadcast ${type} on ${channel}`);
  } catch (error) {
    console.error('[NOTIFY] Broadcast failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Store large payload in database
 */
async function storeLargePayload(pool: Pool, payload: NotificationPayload): Promise<string> {
  const id = crypto.randomUUID();
  await pool.query(
    'INSERT INTO notification_payloads (id, payload, created_at) VALUES ($1, $2, NOW())',
    [id, JSON.stringify(payload)]
  );
  return id;
}

/**
 * Fetch large payload by ID
 */
export async function fetchPayloadById(id: string): Promise<NotificationPayload | null> {
  const pool = getNotificationPool();

  try {
    const result = await pool.query(
      'SELECT payload FROM notification_payloads WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) return null;

    return result.rows[0].payload as NotificationPayload;
  } finally {
    await pool.end();
  }
}

/**
 * Start listening for notifications
 */
export async function startNotificationListener(
  callback: NotificationCallback,
  channels: NotificationChannel[] = ['task_updates', 'agent_updates', 'activity_updates', 'alerts']
): Promise<void> {
  const pool = getNotificationPool();

  try {
    listenerClient = await pool.connect();

    // Listen on all specified channels
    for (const channel of channels) {
      await listenerClient.query(`LISTEN ${channel}`);
    }

    console.log(`[NOTIFY] Listening on channels: ${channels.join(', ')}`);

    // Handle notifications
    listenerClient.on('notification', async (msg) => {
      if (!msg.payload) return;

      try {
        let payload: NotificationPayload = JSON.parse(msg.payload);

        // Check for truncated payload
        if (payload.data?.truncated && payload.data?.payloadId) {
          const fullPayload = await fetchPayloadById(payload.data.payloadId);
          if (fullPayload) payload = fullPayload;
        }

        // Check for duplicates
        const notificationId = `${payload.type}-${payload.timestamp}-${JSON.stringify(payload.data).slice(0, 50)}`;
        if (processedIds.has(notificationId)) {
          console.log(`[NOTIFY] Skipping duplicate: ${payload.type}`);
          return;
        }

        // Track processed
        processedIds.add(notificationId);
        if (processedIds.size > MAX_PROCESSED_IDS) {
          // Remove oldest entries
          const arr = Array.from(processedIds);
          processedIds = new Set(arr.slice(-MAX_PROCESSED_IDS));
        }

        lastNotificationTime = Date.now();

        // Call callback
        callback(msg.channel as NotificationChannel, payload);
      } catch (error) {
        console.error('[NOTIFY] Failed to process notification:', error);
      }
    });

    // Handle connection errors
    listenerClient.on('error', (err) => {
      console.error('[NOTIFY] Connection error:', err);
      if (!isReconnecting) {
        reconnect(callback, channels);
      }
    });

    // Keep connection alive
    listenerClient.on('end', () => {
      console.log('[NOTIFY] Connection ended');
      if (!isReconnecting) {
        reconnect(callback, channels);
      }
    });

  } catch (error) {
    console.error('[NOTIFY] Failed to start listener:', error);
    reconnect(callback, channels);
  }
}

/**
 * Reconnect with exponential backoff
 */
async function reconnect(
  callback: NotificationCallback,
  channels: NotificationChannel[]
): Promise<void> {
  if (isReconnecting) return;

  isReconnecting = true;
  console.log(`[NOTIFY] Reconnecting in ${RECONNECT_DELAY_MS}ms...`);

  await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));

  try {
    await stopNotificationListener();
    await startNotificationListener(callback, channels);
  } catch (error) {
    console.error('[NOTIFY] Reconnect failed:', error);
    setTimeout(() => reconnect(callback, channels), RECONNECT_DELAY_MS * 2);
  } finally {
    isReconnecting = false;
  }
}

/**
 * Stop listening for notifications
 */
export async function stopNotificationListener(): Promise<void> {
  if (listenerClient) {
    try {
      await listenerClient.release();
    } catch (error) {
      // Ignore release errors
    }
    listenerClient = null;
    console.log('[NOTIFY] Listener stopped');
  }
}

/**
 * Setup hybrid sync (notifications + poll fallback)
 */
export function setupHybridSync(
  onUpdate: (changes: NotificationPayload[]) => void,
  fetchChangesSince: (since: number) => Promise<NotificationPayload[]>
): () => void {
  let lastNotification = Date.now();

  // Start notification listener
  startNotificationListener((channel, payload) => {
    lastNotification = Date.now();
    onUpdate([payload]);
  });

  // Setup poll fallback
  const pollInterval = setInterval(async () => {
    const timeSinceLastNotification = Date.now() - lastNotification;

    // Only poll if no notification received recently
    if (timeSinceLastNotification > HYBRID_POLL_INTERVAL_MS) {
      console.log('[NOTIFY] Poll fallback triggered');
      const changes = await fetchChangesSince(lastNotification);

      if (changes.length > 0) {
        lastNotification = Date.now();
        onUpdate(changes);
      }
    }
  }, HYBRID_POLL_INTERVAL_MS);

  // Return cleanup function
  return () => {
    clearInterval(pollInterval);
    stopNotificationListener();
  };
}

/**
 * Get last notification time
 */
export function getLastNotificationTime(): number {
  return lastNotificationTime;
}
