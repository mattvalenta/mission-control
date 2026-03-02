/**
 * Audit Logging Utilities
 * 
 * Tracks all significant actions for security forensics,
 * compliance, and debugging.
 */

import { run, queryAll, queryOne } from './db';

const INSTANCE_ID = process.env.MC_INSTANCE_ID || 'unknown';

// Audit event interface
export interface AuditEvent {
  action: string;
  actor: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  detail?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// Standard action types
export const AuditActions = {
  // Security
  LOGIN: 'login',
  LOGOUT: 'logout',
  LOGIN_FAILED: 'login_failed',
  API_KEY_GENERATED: 'api_key_generated',
  API_KEY_REVOKED: 'api_key_revoked',
  SETTINGS_CHANGED: 'settings_changed',

  // Tasks
  TASK_CREATED: 'task_created',
  TASK_UPDATED: 'task_updated',
  TASK_DELETED: 'task_deleted',
  TASK_DISPATCHED: 'task_dispatched',
  TASK_COMPLETED: 'task_completed',
  TASK_STATUS_CHANGED: 'task_status_changed',

  // Reviews
  REVIEW_SUBMITTED: 'review_submitted',
  REVIEW_APPROVED: 'review_approved',
  REVIEW_REJECTED: 'review_rejected',

  // Agents
  AGENT_CREATED: 'agent_created',
  AGENT_UPDATED: 'agent_updated',
  AGENT_DELETED: 'agent_deleted',
  AGENT_STATUS_CHANGED: 'agent_status_changed',

  // System
  INSTANCE_STARTED: 'instance_started',
  INSTANCE_SHUTDOWN: 'instance_shutdown',
  JOB_COMPLETED: 'job_completed',
  JOB_FAILED: 'job_failed',
  DLQ_ITEM_ADDED: 'dlq_item_added',

  // Token Usage
  TOKEN_USAGE_RECORDED: 'token_usage_recorded',

  // Notifications
  NOTIFICATION_SENT: 'notification_sent',
  NOTIFICATION_DELIVERED: 'notification_delivered',
} as const;

/**
 * Log an audit event
 */
export async function logAuditEvent(event: AuditEvent): Promise<void> {
  await run(
    `INSERT INTO audit_log (
      action, actor, actor_id, actor_instance, 
      target_type, target_id, detail, 
      ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      event.action,
      event.actor,
      event.actorId || null,
      INSTANCE_ID,
      event.targetType || null,
      event.targetId || null,
      event.detail ? JSON.stringify(event.detail) : null,
      event.ipAddress || null,
      event.userAgent || null,
    ]
  );
}

/**
 * Convenience methods for common audit events
 */
export const audit = {
  taskCreated: (taskId: string, detail: { title: string; priority: string }, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.TASK_CREATED,
      actor,
      targetType: 'task',
      targetId: taskId,
      detail,
    }),

  taskDispatched: (taskId: string, agentId: string, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.TASK_DISPATCHED,
      actor,
      targetType: 'task',
      targetId: taskId,
      detail: { agentId },
    }),

  taskCompleted: (taskId: string, summary: string, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.TASK_COMPLETED,
      actor,
      targetType: 'task',
      targetId: taskId,
      detail: { summary },
    }),

  taskStatusChanged: (taskId: string, oldStatus: string, newStatus: string, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.TASK_STATUS_CHANGED,
      actor,
      targetType: 'task',
      targetId: taskId,
      detail: { oldStatus, newStatus },
    }),

  agentCreated: (agentId: string, detail: { name: string; role: string }, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.AGENT_CREATED,
      actor,
      targetType: 'agent',
      targetId: agentId,
      detail,
    }),

  agentStatusChanged: (agentId: string, oldStatus: string, newStatus: string, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.AGENT_STATUS_CHANGED,
      actor,
      targetType: 'agent',
      targetId: agentId,
      detail: { oldStatus, newStatus },
    }),

  reviewSubmitted: (taskId: string, reviewStatus: string, notes: string, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.REVIEW_SUBMITTED,
      actor,
      targetType: 'task',
      targetId: taskId,
      detail: { reviewStatus, notes },
    }),

  settingsChanged: (key: string, oldValue: any, newValue: any, actor = 'system') =>
    logAuditEvent({
      action: AuditActions.SETTINGS_CHANGED,
      actor,
      detail: { key, oldValue, newValue },
    }),

  jobCompleted: (jobName: string, detail: Record<string, any> = {}) =>
    logAuditEvent({
      action: AuditActions.JOB_COMPLETED,
      actor: 'scheduler',
      targetType: 'job',
      targetId: jobName,
      detail,
    }),

  jobFailed: (jobName: string, error: string, detail: Record<string, any> = {}) =>
    logAuditEvent({
      action: AuditActions.JOB_FAILED,
      actor: 'scheduler',
      targetType: 'job',
      targetId: jobName,
      detail: { error, ...detail },
    }),

  dlqItemAdded: (jobName: string, reason: string, retryCount: number) =>
    logAuditEvent({
      action: AuditActions.DLQ_ITEM_ADDED,
      actor: 'scheduler',
      targetType: 'job',
      targetId: jobName,
      detail: { reason, retryCount },
    }),

  tokenUsage: (agentId: string, model: string, inputTokens: number, outputTokens: number, cost: number) =>
    logAuditEvent({
      action: AuditActions.TOKEN_USAGE_RECORDED,
      actor: agentId,
      detail: { model, inputTokens, outputTokens, cost },
    }),
};

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  action?: string;
  actor?: string;
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.action) {
    conditions.push(`action = $${paramIndex++}`);
    params.push(filters.action);
  }

  if (filters.actor) {
    conditions.push(`actor = $${paramIndex++}`);
    params.push(filters.actor);
  }

  if (filters.targetType) {
    conditions.push(`target_type = $${paramIndex++}`);
    params.push(filters.targetType);
  }

  if (filters.targetId) {
    conditions.push(`target_id = $${paramIndex++}`);
    params.push(filters.targetId);
  }

  if (filters.startDate) {
    conditions.push(`created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  params.push(limit, offset);

  return queryAll(
    `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    params
  );
}

/**
 * Get security-specific events
 */
export async function getSecurityEvents(limit = 50) {
  const securityActions = [
    'login', 'logout', 'login_failed',
    'api_key_generated', 'api_key_revoked',
    'settings_changed',
  ];

  return queryAll(
    `SELECT * FROM audit_log 
     WHERE action = ANY($1) 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [securityActions, limit]
  );
}

/**
 * Get audit statistics
 */
export async function getAuditStats(days = 7) {
  return queryOne<{
    total_events: string;
    unique_actors: string;
    top_actions: Array<{ action: string; count: string }>;
  }>(
    `SELECT 
      COUNT(*) as total_events,
      COUNT(DISTINCT actor) as unique_actors,
      json_agg(json_build_object('action', action, 'count', count)) as top_actions
    FROM (
      SELECT action, actor, COUNT(*) as count
      FROM audit_log
      WHERE created_at > NOW() - INTERVAL '1 day' * $1
      GROUP BY action, actor
      ORDER BY count DESC
      LIMIT 10
    ) sub`,
    [days]
  );
}
