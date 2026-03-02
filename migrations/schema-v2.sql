-- ============================================================
-- Mission Control PostgreSQL Schema v2.0
-- ============================================================
-- 
-- This schema replaces SQLite as the primary database for
-- distributed Mission Control architecture.
--
-- Migration from SQLite:
-- - datetime('now') → NOW()
-- - INTEGER booleans → BOOLEAN
-- - TEXT for JSON → JSONB
-- - ? placeholders → $1, $2, $3
--
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- MISSION CONTROL INSTANCES
-- ============================================================

CREATE TABLE IF NOT EXISTS mc_instances (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  hostname TEXT,
  ip_address TEXT,
  role TEXT CHECK (role IN ('master', 'worker')),
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline', 'degraded')),
  last_heartbeat TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP DEFAULT NOW(),
  version TEXT
);

CREATE INDEX IF NOT EXISTS idx_mc_instances_status ON mc_instances(status);

-- ============================================================
-- WORKSPACES
-- ============================================================

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- AGENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline', 'error')),
  is_master BOOLEAN DEFAULT false,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT REFERENCES agents(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  model TEXT,
  discord_channel TEXT,
  instance_id TEXT REFERENCES mc_instances(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_tier ON agents(tier);
CREATE INDEX IF NOT EXISTS idx_agents_manager ON agents(manager_id);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'quality_review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TIMESTAMP,
  version INTEGER DEFAULT 1,
  
  -- Planning fields
  planning_session_key TEXT,
  planning_messages JSONB,
  planning_complete BOOLEAN DEFAULT false,
  planning_spec TEXT,
  planning_agents JSONB,
  planning_dispatch_error TEXT,
  
  -- Tier fields
  tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT,
  subagent_type TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(tier);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);

-- ============================================================
-- PLANNING
-- ============================================================

CREATE TABLE IF NOT EXISTS planning_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options JSONB,
  answer TEXT,
  answered_at TIMESTAMP,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);

CREATE TABLE IF NOT EXISTS planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TIMESTAMP NOT NULL,
  locked_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- TASK ACTIVITIES & DELIVERABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_agent ON task_activities(agent_id);

CREATE TABLE IF NOT EXISTS task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('file', 'url', 'artifact')),
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliverables_task ON task_deliverables(task_id);

-- ============================================================
-- OPENCLAW SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'ended')),
  session_type TEXT DEFAULT 'persistent' CHECK (session_type IN ('persistent', 'subagent')),
  task_id TEXT REFERENCES tasks(id),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_agent ON openclaw_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);

-- ============================================================
-- EVENTS (LIVE FEED)
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'task')),
  task_id TEXT REFERENCES tasks(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (conversation_id, agent_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

-- ============================================================
-- CONTENT PIPELINE
-- ============================================================

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linkedin_post', 'x_post', 'x_thread', 'carousel', 'blog')),
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'facebook', 'instagram')),
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea', 'research', 'draft', 'humanize', 'schedule', 'publish', 'analysis', 'denied')),
  content TEXT,
  research TEXT,
  schedule TEXT,
  analysis TEXT,
  assigned_to TEXT,
  denied_at TIMESTAMP,
  denied_by TEXT,
  denial_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  published_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_items_stage ON content_items(stage);
CREATE INDEX IF NOT EXISTS idx_content_items_platform ON content_items(platform);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('cron', 'meeting', 'deadline', 'reminder')),
  tier TEXT NOT NULL DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  color TEXT,
  recurring TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_agent ON calendar_events(agent_id);

-- ============================================================
-- TEAM MEMBERS
-- ============================================================

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('skippy', 'manager', 'subagent')),
  role TEXT NOT NULL,
  manager_id TEXT REFERENCES team_members(id),
  status TEXT DEFAULT 'offline' CHECK (status IN ('active', 'idle', 'on-demand', 'offline')),
  discord_id TEXT,
  workspace_path TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_tier ON team_members(tier);
CREATE INDEX IF NOT EXISTS idx_team_members_manager ON team_members(manager_id);

-- ============================================================
-- TOKEN USAGE (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id TEXT,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  cost REAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_task ON token_usage(task_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);

-- ============================================================
-- QUALITY REVIEWS (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS quality_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  reviewer_id TEXT REFERENCES agents(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested')),
  notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_reviews_task ON quality_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_status ON quality_reviews(status);

-- ============================================================
-- AUDIT LOG (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ============================================================
-- SCHEDULED JOBS (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  handler TEXT NOT NULL,
  interval_seconds INTEGER NOT NULL,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES scheduled_jobs(id),
  instance_id TEXT NOT NULL,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_executions_job ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);

-- ============================================================
-- DEAD LETTER QUEUE (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  job_id UUID REFERENCES scheduled_jobs(id),
  payload JSONB,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_dlq_created ON dead_letter_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;

-- ============================================================
-- WEBHOOKS (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT,
  events JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID REFERENCES webhooks(id),
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

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending ON webhook_deliveries(status) 
  WHERE status IN ('pending', 'retrying');

-- ============================================================
-- FEATURE FLAGS (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  rollout_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- METRICS (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  value REAL NOT NULL,
  tags JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name_date ON metrics(name, created_at DESC);

-- ============================================================
-- BUSINESSES (Legacy compatibility)
-- ============================================================

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MEMORY FILES CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_files (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  cached_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (agent_id) REFERENCES team_members(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_files_agent ON memory_files(agent_id);

-- ============================================================
-- NOTIFICATION TRIGGERS
-- ============================================================

-- Automatically notify on task changes
CREATE OR REPLACE FUNCTION notify_task_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('task_updates', json_build_object(
    'type', 'task_updated',
    'instanceId', 'database_trigger',
    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000,
    'data', json_build_object('taskId', NEW.id, 'updates', row_to_json(NEW))
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_notify ON tasks;
CREATE TRIGGER task_notify AFTER UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_task_change();

-- Automatically notify on agent changes
CREATE OR REPLACE FUNCTION notify_agent_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_updates', json_build_object(
    'type', 'agent_updated',
    'instanceId', 'database_trigger',
    'timestamp', EXTRACT(EPOCH FROM NOW()) * 1000,
    'data', json_build_object('agentId', NEW.id, 'updates', row_to_json(NEW))
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_notify ON agents;
CREATE TRIGGER agent_notify AFTER UPDATE ON agents
FOR EACH ROW EXECUTE FUNCTION notify_agent_change();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Insert default workspace if not exists
INSERT INTO workspaces (id, name, slug, description, icon)
VALUES ('default', 'Default Workspace', 'default', 'Default workspace for Mission Control', '📁')
ON CONFLICT (id) DO NOTHING;

-- Insert Skippy as master agent if not exists
INSERT INTO agents (id, name, role, description, status, is_master, tier, avatar_emoji)
VALUES ('skippy', 'Skippy', 'Master Agent', 'CEO and orchestrator of all agents', 'standby', true, 'skippy', '🍺')
ON CONFLICT (id) DO NOTHING;
