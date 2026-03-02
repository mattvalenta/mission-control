/**
 * Built-in Job Handlers
 * 
 * These are the default handlers for scheduled jobs.
 */

import { run, queryAll } from './db';
import { registerHandler, getPendingJobs, claimAndRunJob, INSTANCE_ID } from './scheduler';

const AGENT_NAME = process.env.MC_AGENT_NAME || 'Unknown Agent';
const INSTANCE_ROLE = process.env.MC_INSTANCE_ROLE || 'worker';

/**
 * Instance heartbeat
 * Updates instance status in mc_instances table
 */
export async function instanceHeartbeat(): Promise<void> {
  // Use actual schema: id, agent_name, role, status, last_heartbeat
  await run(
    `INSERT INTO mc_instances (id, agent_name, role, status, last_heartbeat, started_at)
     VALUES ($1, $2, $3, 'online', NOW(), NOW())
     ON CONFLICT (id) 
     DO UPDATE SET 
       last_heartbeat = NOW(), 
       status = 'online'`,
    [INSTANCE_ID, AGENT_NAME, INSTANCE_ROLE]
  );

  console.log(`[instanceHeartbeat] Heartbeat sent for ${INSTANCE_ID} (${AGENT_NAME})`);
}

/**
 * Cleanup stale sessions
 * Mark sessions inactive after 2 hours of no activity
 */
export async function cleanupStaleSessions(): Promise<void> {
  const result = await run(
    `UPDATE openclaw_sessions 
     SET status = 'inactive' 
     WHERE status = 'active' 
       AND updated_at < NOW() - INTERVAL '2 hours'`
  );

  console.log(`[cleanupStaleSessions] Marked ${result.rowCount || 0} sessions as inactive`);
}

/**
 * Check agent heartbeats
 * Mark agents offline if no update in 5 minutes
 */
export async function checkAgentHeartbeats(): Promise<void> {
  const result = await run(
    `UPDATE agents 
     SET status = 'offline' 
     WHERE status != 'offline' 
       AND updated_at < NOW() - INTERVAL '5 minutes'`
  );

  console.log(`[checkAgentHeartbeats] Marked ${result.rowCount || 0} agents as offline`);
}

/**
 * Cleanup old audit logs
 * Remove logs older than 90 days
 */
export async function cleanupOldAuditLogs(): Promise<void> {
  const result = await run(
    `DELETE FROM audit_log 
     WHERE created_at < NOW() - INTERVAL '90 days'`
  );

  console.log(`[cleanupOldAuditLogs] Removed ${result.rowCount || 0} old audit logs`);
}

/**
 * Cleanup old notification payloads
 * Remove payloads older than 1 hour (already delivered)
 */
export async function cleanupOldNotifications(): Promise<void> {
  const result = await run(
    `DELETE FROM notification_payloads 
     WHERE created_at < NOW() - INTERVAL '1 hour'`
  );

  console.log(`[cleanupOldNotifications] Removed ${result.rowCount || 0} old notification payloads`);
}

/**
 * Aggregate token usage
 * Pre-calculate daily stats for faster dashboard queries
 */
export async function aggregateTokenUsage(): Promise<void> {
  try {
    // Create table if not exists
    await run(`
      CREATE TABLE IF NOT EXISTS token_usage_daily (
        date DATE PRIMARY KEY,
        total_tokens BIGINT DEFAULT 0,
        total_cost DECIMAL(10, 4) DEFAULT 0,
        total_input_tokens BIGINT DEFAULT 0,
        total_output_tokens BIGINT DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Aggregate today's usage
    const today = new Date().toISOString().split('T')[0];

    await run(`
      INSERT INTO token_usage_daily (date, total_tokens, total_cost, total_input_tokens, total_output_tokens, record_count, updated_at)
      SELECT 
        CURRENT_DATE as date,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(total_cost), 0) as total_cost,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COUNT(*) as record_count,
        NOW() as updated_at
      FROM token_usage
      WHERE DATE(created_at) = CURRENT_DATE
      ON CONFLICT (date) 
      DO UPDATE SET 
        total_tokens = EXCLUDED.total_tokens,
        total_cost = EXCLUDED.total_cost,
        total_input_tokens = EXCLUDED.total_input_tokens,
        total_output_tokens = EXCLUDED.total_output_tokens,
        record_count = EXCLUDED.record_count,
        updated_at = NOW()
    `);

    console.log(`[aggregateTokenUsage] Aggregated token usage for ${today}`);
  } catch (err) {
    console.error('[aggregateTokenUsage] Error:', err);
  }
}

/**
 * Mark offline instances
 * Set status to offline if no heartbeat in 5 minutes
 */
export async function markOfflineInstances(): Promise<void> {
  const result = await run(
    `UPDATE mc_instances 
     SET status = 'offline'
     WHERE status = 'online' 
       AND last_heartbeat < NOW() - INTERVAL '5 minutes'`
  );

  console.log(`[markOfflineInstances] Marked ${result.rowCount || 0} instances as offline`);
}

/**
 * Process pending webhook deliveries
 */
export async function processWebhookDeliveries(): Promise<void> {
  const { processPendingDeliveries } = await import('./webhooks');
  const processed = await processPendingDeliveries();
  console.log(`[processWebhookDeliveries] Processed ${processed} deliveries`);
}

/**
 * Register all built-in handlers
 */
export function registerBuiltinHandlers(): void {
  registerHandler('instanceHeartbeat', instanceHeartbeat);
  registerHandler('cleanupStaleSessions', cleanupStaleSessions);
  registerHandler('checkAgentHeartbeats', checkAgentHeartbeats);
  registerHandler('cleanupOldAuditLogs', cleanupOldAuditLogs);
  registerHandler('cleanupOldNotifications', cleanupOldNotifications);
  registerHandler('aggregateTokenUsage', aggregateTokenUsage);
  registerHandler('markOfflineInstances', markOfflineInstances);
  registerHandler('processWebhookDeliveries', processWebhookDeliveries);

  console.log('[JobHandlers] Registered 8 built-in handlers');
}

// Re-export for use in instrumentation
export { INSTANCE_ID };
