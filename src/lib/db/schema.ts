/**
 * Database Schema for Mission Control
 * 
 * This defines the current desired schema state.
 * For existing databases, migrations handle schema updates.
 * 
 * IMPORTANT: When adding new tables or columns:
 * 1. Add them here for new databases
 * 2. Create a migration in migrations.ts for existing databases
 */

export const schema = `
-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT '📁',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_emoji TEXT DEFAULT '🤖',
  status TEXT DEFAULT 'standby' CHECK (status IN ('standby', 'working', 'offline')),
  is_master INTEGER DEFAULT 0,
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  soul_md TEXT,
  user_md TEXT,
  agents_md TEXT,
  model TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Tasks table (Mission Queue)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'inbox' CHECK (status IN ('pending_dispatch', 'planning', 'inbox', 'assigned', 'in_progress', 'testing', 'review', 'done')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_agent_id TEXT REFERENCES agents(id),
  created_by_agent_id TEXT REFERENCES agents(id),
  workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id),
  business_id TEXT DEFAULT 'default',
  due_date TEXT,
  planning_session_key TEXT,
  planning_messages TEXT,
  planning_complete INTEGER DEFAULT 0,
  planning_spec TEXT,
  planning_agents TEXT,
  planning_dispatch_error TEXT,
  tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  manager_id TEXT,
  subagent_type TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Planning questions table
CREATE TABLE IF NOT EXISTS planning_questions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options TEXT,
  answer TEXT,
  answered_at TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Planning specs table (locked specifications)
CREATE TABLE IF NOT EXISTS planning_specs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at TEXT NOT NULL,
  locked_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversations table (agent-to-agent or task-related)
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  type TEXT DEFAULT 'direct' CHECK (type IN ('direct', 'group', 'task')),
  task_id TEXT REFERENCES tasks(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE CASCADE,
  joined_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id TEXT REFERENCES agents(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Events table (for live feed)
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  task_id TEXT REFERENCES tasks(id),
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Businesses/Workspaces table (legacy - kept for compatibility)
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- OpenClaw session mapping
CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel TEXT,
  status TEXT DEFAULT 'active',
  session_type TEXT DEFAULT 'persistent',
  task_id TEXT REFERENCES tasks(id),
  ended_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Task activities table (for real-time activity log)
CREATE TABLE IF NOT EXISTS task_activities (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Task deliverables table (files, URLs, artifacts)
CREATE TABLE IF NOT EXISTS task_deliverables (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  title TEXT NOT NULL,
  path TEXT,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Content pipeline table
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linkedin_post', 'x_post', 'x_thread', 'carousel', 'blog')),
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'facebook', 'instagram')),
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea', 'research', 'draft', 'humanize', 'schedule', 'publish', 'analysis')),
  content TEXT,
  research TEXT,
  schedule TEXT,
  analysis TEXT,
  assigned_to TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

-- Calendar events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  type TEXT NOT NULL CHECK (type IN ('cron', 'meeting', 'deadline', 'reminder')),
  tier TEXT NOT NULL DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent')),
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  color TEXT,
  recurring TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Team members table
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Memory files cache table
CREATE TABLE IF NOT EXISTS memory_files (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  cached_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (agent_id) REFERENCES team_members(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_activities_task ON task_activities(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverables_task ON task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_content_items_stage ON content_items(stage);
CREATE INDEX IF NOT EXISTS idx_content_items_platform ON content_items(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_agent ON calendar_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_members_tier ON team_members(tier);
CREATE INDEX IF NOT EXISTS idx_team_members_manager ON team_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_memory_files_agent ON memory_files(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(tier);
CREATE INDEX IF NOT EXISTS idx_tasks_manager ON tasks(manager_id);
`;
