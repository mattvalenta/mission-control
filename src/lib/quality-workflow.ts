/**
 * Quality Review Workflow Utilities
 */

import { queryOne, run } from '@/lib/db';
import { notifyBoth } from './db/notify-wrapper';

export interface ReviewRequest {
  taskId: string;
  requiresReview: boolean;
  reviewLevel: 'none' | 'single' | 'double';
  currentStage: number;
}

/**
 * Check if a task requires quality review
 */
export async function checkReviewRequirement(taskId: string): Promise<ReviewRequest> {
  const task = await queryOne<{
    id: string;
    priority: string;
    status: string;
    metadata?: any;
  }>('SELECT id, priority, status, metadata FROM tasks WHERE id = $1', [taskId]);

  if (!task) {
    return {
      taskId,
      requiresReview: false,
      reviewLevel: 'none',
      currentStage: 0,
    };
  }

  // Determine review requirement based on task properties
  const requiresReview = 
    task.priority === 'high' ||
    task.priority === 'urgent' ||
    task.metadata?.requires_review === true ||
    task.metadata?.is_deployment === true;

  // High priority = double review (manager + master)
  // Urgent = double review
  // Normal with requires_review = single review
  const reviewLevel = 
    (task.priority === 'high' || task.priority === 'urgent') ? 'double' :
    requiresReview ? 'single' : 'none';

  // Check current stage from existing reviews
  const reviews = await queryOne<{ count: string }>(
    'SELECT COUNT(*) as count FROM quality_reviews WHERE task_id = $1 AND status = $2',
    [taskId, 'approved']
  );

  const currentStage = parseInt(reviews?.count || '0');

  return {
    taskId,
    requiresReview,
    reviewLevel,
    currentStage,
  };
}

/**
 * Determine next status after task completion attempt
 */
export async function getNextStatusAfterCompletion(
  taskId: string,
  currentStatus: string
): Promise<string> {
  // If already in review/quality_review, stay
  if (['review', 'quality_review'].includes(currentStatus)) {
    return currentStatus;
  }

  // Check if review is required
  const reviewReq = await checkReviewRequirement(taskId);

  if (!reviewReq.requiresReview) {
    // No review required → done
    return 'done';
  }

  // Review required → move to review
  return 'review';
}

/**
 * Process task completion with review check
 */
export async function processTaskCompletion(
  taskId: string,
  agentId: string,
  message?: string
): Promise<{ status: string; message: string }> {
  const task = await queryOne<{ id: string; status: string; title: string }>(
    'SELECT id, status, title FROM tasks WHERE id = $1',
    [taskId]
  );

  if (!task) {
    throw new Error('Task not found');
  }

  // Check if already in review
  if (['review', 'quality_review'].includes(task.status)) {
    return {
      status: task.status,
      message: 'Task already in review queue',
    };
  }

  // Determine next status
  const nextStatus = await getNextStatusAfterCompletion(taskId, task.status);

  // Update task
  await run(
    'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
    [nextStatus, taskId]
  );

  // Log activity
  await run(
    `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      crypto.randomUUID(),
      taskId,
      agentId,
      nextStatus === 'done' ? 'completed' : 'submitted_for_review',
      message || `Task moved to ${nextStatus}`,
    ]
  );

  // Notify
  await notifyBoth('task_updates', 
    nextStatus === 'done' ? 'task_completed' : 'task_pending_review',
    { taskId, status: nextStatus, agentId }
  );

  return {
    status: nextStatus,
    message: nextStatus === 'done' 
      ? 'Task completed successfully' 
      : 'Task submitted for quality review',
  };
}

/**
 * Get review status summary
 */
export async function getReviewSummary(taskId: string): Promise<{
  totalReviews: number;
  approvedCount: number;
  rejectedCount: number;
  pendingCount: number;
  lastReview?: {
    status: string;
    reviewedAt: string;
    reviewerName?: string;
  };
}> {
  const stats = await queryOne<{
    total: string;
    approved: string;
    rejected: string;
    pending: string;
  }>(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM quality_reviews
    WHERE task_id = $1
  `, [taskId]);

  const lastReview = await queryOne<{
    status: string;
    reviewed_at: string;
    reviewer_name: string | null;
  }>(`
    SELECT qr.status, qr.reviewed_at, a.name as reviewer_name
    FROM quality_reviews qr
    LEFT JOIN agents a ON qr.reviewer_id = a.id
    WHERE qr.task_id = $1 AND qr.reviewed_at IS NOT NULL
    ORDER BY qr.reviewed_at DESC
    LIMIT 1
  `, [taskId]);

  return {
    totalReviews: parseInt(stats?.total || '0'),
    approvedCount: parseInt(stats?.approved || '0'),
    rejectedCount: parseInt(stats?.rejected || '0'),
    pendingCount: parseInt(stats?.pending || '0'),
    lastReview: lastReview ? {
      status: lastReview.status,
      reviewedAt: lastReview.reviewed_at,
      reviewerName: lastReview.reviewer_name || undefined,
    } : undefined,
  };
}
