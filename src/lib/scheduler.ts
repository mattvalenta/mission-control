/**
 * Distributed Job Scheduler
 * 
 * Uses PostgreSQL advisory locks for coordination across
 * multiple Mission Control instances.
 * 
 * CRITICAL: Use hashtext() for collision-resistant 64-bit locks
 */

import { queryOne, queryAll, run } from './db';
import { notifyBoth } from './db/notify-wrapper';

const INSTANCE_ID = process.env.MC_INSTANCE_ID || `instance-${Date.now()}`;

// Job handler type
type JobHandler = () => Promise<void>;

// Registered handlers
const handlers: Map<string, JobHandler> = new Map();

// Heartbeat interval reference
const heartbeats: Map<string, NodeJS.Timeout> = new Map();

/**
 * Register a job handler
 */
export function registerHandler(name: string, handler: JobHandler) {
  handlers.set(name, handler);
}

/**
 * Claim and run a job using advisory locks
 * Returns true if job was claimed and run, false otherwise
 */
export async function claimAndRunJob(jobName: string): Promise<boolean> {
  // Use hashtext() for collision-resistant 64-bit lock
  const lockResult = await queryOne<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)) as locked',
    [jobName]
  );

  if (!lockResult?.locked) {
    return false; // Another instance has this job
  }

  try {
    // Check if job is due
    const job = await queryOne<{
      id: string;
      handler: string;
      interval_seconds: number;
    }>(
      `SELECT id, handler, interval_seconds FROM scheduled_jobs 
       WHERE name = $1 AND enabled = true 
         AND (next_run IS NULL OR next_run <= NOW())`,
      [jobName]
    );

    if (!job) return false;

    // Record execution
    const execution = await queryOne<{ id: string }>(
      `INSERT INTO job_executions (job_id, instance_id, status, started_at)
       VALUES ($1, $2, 'running', NOW()) RETURNING id`,
      [job.id, INSTANCE_ID]
    );

    if (!execution) {
      return false;
    }

    // Start heartbeat for long jobs
    startHeartbeat(execution.id);

    try {
      // Run the handler
      await runJobHandler(job.handler);

      // Mark as completed
      await completeJob(execution.id, job.id, job.interval_seconds);

      return true;
    } catch (err) {
      // Mark as failed
      await failJob(execution.id, job.id, job.handler, String(err));
      throw err;
    } finally {
      stopHeartbeat(execution.id);
    }
  } finally {
    // Release lock
    await run('SELECT pg_advisory_unlock(hashtext($1))', [jobName]);
  }
}

/**
 * Run a registered job handler
 */
async function runJobHandler(handlerName: string): Promise<void> {
  const handler = handlers.get(handlerName);

  if (!handler) {
    throw new Error(`No handler registered for: ${handlerName}`);
  }

  await handler();
}

/**
 * Start heartbeat for a running job
 */
function startHeartbeat(executionId: string) {
  const interval = setInterval(async () => {
    await run(
      'UPDATE job_executions SET heartbeat_at = NOW() WHERE id = $1',
      [executionId]
    );
  }, 60000); // Every minute

  heartbeats.set(executionId, interval);
}

/**
 * Stop heartbeat for a job
 */
function stopHeartbeat(executionId: string) {
  const interval = heartbeats.get(executionId);
  if (interval) {
    clearInterval(interval);
    heartbeats.delete(executionId);
  }
}

/**
 * Mark job as completed
 */
async function completeJob(
  executionId: string,
  jobId: string,
  intervalSeconds: number
) {
  await run(
    `UPDATE job_executions SET status = 'completed', completed_at = NOW() 
     WHERE id = $1`,
    [executionId]
  );

  // Update next run time
  await run(
    `UPDATE scheduled_jobs 
     SET last_run = NOW(), next_run = NOW() + INTERVAL '1 second' * $1
     WHERE id = $2`,
    [intervalSeconds, jobId]
  );
}

/**
 * Mark job as failed
 */
async function failJob(
  executionId: string,
  jobId: string,
  jobName: string,
  error: string
) {
  await run(
    `UPDATE job_executions SET status = 'failed', error = $1, completed_at = NOW() 
     WHERE id = $2`,
    [error, executionId]
  );

  // Check failure count in last 24 hours
  const failCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM job_executions 
     WHERE job_id = $1 AND status = 'failed' 
       AND started_at > NOW() - INTERVAL '1 day'`,
    [jobId]
  );

  const count = parseInt(failCount?.count || '0');

  // Move to DLQ after 3 failures
  if (count >= 3) {
    await moveToDLQ(jobName, jobId, error, count);
  }
}

/**
 * Move job to Dead Letter Queue
 */
async function moveToDLQ(
  jobName: string,
  jobId: string,
  error: string,
  retryCount: number
) {
  await run(
    `INSERT INTO dead_letter_queue (job_name, job_id, failure_reason, retry_count)
     VALUES ($1, $2, $3, $4)`,
    [jobName, jobId, error, retryCount]
  );

  // Disable the failing job
  await run(
    'UPDATE scheduled_jobs SET enabled = false WHERE id = $1',
    [jobId]
  );

  // Alert via notification
  await notifyBoth('alerts', 'job_dead_lettered', {
    jobName,
    error,
    retryCount,
    instanceId: INSTANCE_ID,
  });
}

/**
 * Get all pending jobs
 */
export async function getPendingJobs() {
  return queryAll<{
    id: string;
    name: string;
    handler: string;
    interval_seconds: number;
    next_run: string | null;
  }>(
    `SELECT id, name, handler, interval_seconds, next_run 
     FROM scheduled_jobs 
     WHERE enabled = true 
       AND (next_run IS NULL OR next_run <= NOW() + INTERVAL '5 minutes')
     ORDER BY next_run ASC NULLS FIRST`
  );
}

/**
 * Get DLQ entries
 */
export async function getDLQEntries(unresolvedOnly = true) {
  const whereClause = unresolvedOnly ? 'WHERE resolved_at IS NULL' : '';

  return queryAll(
    `SELECT * FROM dead_letter_queue ${whereClause} ORDER BY created_at DESC`
  );
}

/**
 * Resolve a DLQ entry
 */
export async function resolveDLQEntry(id: string, resolvedBy: string) {
  await run(
    'UPDATE dead_letter_queue SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2',
    [resolvedBy, id]
  );
}

/**
 * Retry a DLQ entry
 */
export async function retryDLQEntry(id: string) {
  const entry = await queryOne<{
    job_name: string;
    job_id: string;
  }>('SELECT job_name, job_id FROM dead_letter_queue WHERE id = $1', [id]);

  if (!entry) {
    throw new Error('DLQ entry not found');
  }

  // Re-enable the job
  await run(
    'UPDATE scheduled_jobs SET enabled = true WHERE id = $1',
    [entry.job_id]
  );

  // Mark as resolved
  await run(
    'UPDATE dead_letter_queue SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2',
    ['retry', id]
  );
}

/**
 * Get job status
 */
export async function getJobStatus() {
  return queryAll('SELECT * FROM job_status_view ORDER BY name');
}

/**
 * Get execution history
 */
export async function getExecutionHistory(limit = 50) {
  return queryAll(
    `SELECT je.*, sj.name as job_name 
     FROM job_executions je
     JOIN scheduled_jobs sj ON je.job_id = sj.id
     ORDER BY je.started_at DESC
     LIMIT $1`,
    [limit]
  );
}

export { INSTANCE_ID };
