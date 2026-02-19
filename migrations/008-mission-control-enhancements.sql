-- Migration: Mission Control Enhancements
-- Adds tier system, content pipeline, calendar, team hierarchy, and memory features

-- Extend tasks table with tier system
ALTER TABLE tasks ADD COLUMN tier TEXT DEFAULT 'manager' CHECK (tier IN ('skippy', 'manager', 'subagent'));
ALTER TABLE tasks ADD COLUMN manager_id TEXT;
ALTER TABLE tasks ADD COLUMN subagent_type TEXT;

-- Content pipeline table
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('linkedin_post', 'x_post', 'x_thread', 'carousel', 'blog')),
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'facebook', 'instagram')),
  stage TEXT NOT NULL DEFAULT 'idea' CHECK (stage IN ('idea', 'research', 'draft', 'humanize', 'schedule', 'publish', 'analysis')),
  content TEXT,  -- JSON string with hook, body, fullContent, attachments
  research TEXT,  -- JSON string with trendingTopics, competitorPosts, hashtags
  schedule TEXT,  -- JSON string with publishAt, timezone
  analysis TEXT,  -- JSON string with likes, comments, shares, views, engagementRate
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
  recurring TEXT,  -- JSON string with frequency, interval, endDate
  created_at TEXT DEFAULT (datetime('now'))
);

-- Team members table (extends agents with hierarchy info)
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

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_content_items_stage ON content_items(stage);
CREATE INDEX IF NOT EXISTS idx_content_items_platform ON content_items(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_agent ON calendar_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_team_members_tier ON team_members(tier);
CREATE INDEX IF NOT EXISTS idx_team_members_manager ON team_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_memory_files_agent ON memory_files(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(tier);
CREATE INDEX IF NOT EXISTS idx_tasks_manager ON tasks(manager_id);
