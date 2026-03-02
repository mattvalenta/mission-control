-- ============================================================
-- Phase 5: Job Queue + Dead Letter Queue
-- ============================================================
-- 
-- Distributed job queue using PostgreSQL advisory locks
-- for coordination across multiple MC instances.
--
-- ============================================================

-- Scheduled jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  handler TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Job execution history
CREATE TABLE IF NOT EXISTS job_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  heartbeat_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_executions_job ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_job_executions_instance ON job_executions(instance_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_started ON job_executions(started_at DESC);

-- Dead Letter Queue
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  original_job_id UUID,
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlq_created ON dead_letter_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON dead_letter_queue(resolved_at) 
  WHERE resolved_at IS NULL;

-- View for job status with execution stats
CREATE OR REPLACE VIEW job_status_view AS
SELECT 
  sj.id,
  sj.name,
  sj.handler,
  sj.interval_seconds,
  sj.enabled,
  sj.last_run,
  sj.next_run,
  (SELECT COUNT(*) FROM job_executions je WHERE je.job_id = sj.id) as total_executions,
  (SELECT COUNT(*) FROM job_executions je WHERE je.job_id = sj.id AND je.status = 'completed') as successful_runs,
  (SELECT COUNT(*) FROM job_executions je WHERE je.job_id = sj.id AND je.status = 'failed') as failed_runs,
  (SELECT je.started_at FROM job_executions je WHERE je.job_id = sj.id ORDER BY je.started_at DESC LIMIT 1) as last_execution
FROM scheduled_jobs sj;

-- Insert default jobs
INSERT INTO scheduled_jobs (name, handler, interval_seconds, enabled) VALUES
  ('cleanup-stale-sessions', 'cleanupStaleSessions', 3600, true),
  ('check-agent-heartbeats', 'checkAgentHeartbeats', 1800, true),
  ('cleanup-old-audit-logs', 'cleanupOldAuditLogs', 604800, true),
  ('cleanup-old-notifications', 'cleanupOldNotifications', 3600, true),
  ('aggregate-token-usage', 'aggregateTokenUsage', 3600, true)
ON CONFLICT (name) DO NOTHING;

SELECT 'Job queue schema created' as result;
