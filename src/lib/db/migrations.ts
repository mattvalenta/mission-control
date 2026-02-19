/**
 * Database Migrations System
 * 
 * Handles schema changes in a production-safe way:
 * 1. Tracks which migrations have been applied
 * 2. Runs new migrations automatically on startup
 * 3. Never runs the same migration twice
 */

import Database from 'better-sqlite3';

interface Migration {
  id: string;
  name: string;
  up: (db: Database.Database) => void;
}

// All migrations in order - NEVER remove or reorder existing migrations
const migrations: Migration[] = [
  {
    id: '001',
    name: 'initial_schema',
    up: (db) => {
      // Core tables - these are created in schema.ts on fresh databases
      // This migration exists to mark the baseline for existing databases
      console.log('[Migration 001] Baseline schema marker');
    }
  },
  {
    id: '002',
    name: 'add_workspaces',
    up: (db) => {
      console.log('[Migration 002] Adding workspaces table and columns...');
      
      // Create workspaces table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          icon TEXT DEFAULT '📁',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Insert default workspace if not exists
      db.exec(`
        INSERT OR IGNORE INTO workspaces (id, name, slug, description, icon) 
        VALUES ('default', 'Default Workspace', 'default', 'Default workspace', '🏠');
      `);
      
      // Add workspace_id to tasks if not exists
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      if (!tasksInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to tasks');
      }
      
      // Add workspace_id to agents if not exists
      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
      if (!agentsInfo.some(col => col.name === 'workspace_id')) {
        db.exec(`ALTER TABLE agents ADD COLUMN workspace_id TEXT DEFAULT 'default' REFERENCES workspaces(id)`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id)`);
        console.log('[Migration 002] Added workspace_id to agents');
      }
    }
  },
  {
    id: '003',
    name: 'add_planning_tables',
    up: (db) => {
      console.log('[Migration 003] Adding planning tables...');
      
      // Create planning_questions table if not exists
      db.exec(`
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
      `);
      
      // Create planning_specs table if not exists
      db.exec(`
        CREATE TABLE IF NOT EXISTS planning_specs (
          id TEXT PRIMARY KEY,
          task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
          spec_markdown TEXT NOT NULL,
          locked_at TEXT NOT NULL,
          locked_by TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      
      // Create index
      db.exec(`CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order)`);
      
      // Update tasks status check constraint to include 'planning'
      // SQLite doesn't support ALTER CONSTRAINT, so we check if it's needed
      const taskSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { sql: string } | undefined;
      if (taskSchema && !taskSchema.sql.includes("'planning'")) {
        console.log('[Migration 003] Note: tasks table needs planning status - will be handled by schema recreation on fresh dbs');
      }
    }
  },
  {
    id: '004',
    name: 'add_planning_session_columns',
    up: (db) => {
      console.log('[Migration 004] Adding planning session columns to tasks...');

      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];

      // Add planning_session_key column
      if (!tasksInfo.some(col => col.name === 'planning_session_key')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_session_key TEXT`);
        console.log('[Migration 004] Added planning_session_key');
      }

      // Add planning_messages column (stores JSON array of messages)
      if (!tasksInfo.some(col => col.name === 'planning_messages')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_messages TEXT`);
        console.log('[Migration 004] Added planning_messages');
      }

      // Add planning_complete column
      if (!tasksInfo.some(col => col.name === 'planning_complete')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_complete INTEGER DEFAULT 0`);
        console.log('[Migration 004] Added planning_complete');
      }

      // Add planning_spec column (stores final spec JSON)
      if (!tasksInfo.some(col => col.name === 'planning_spec')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_spec TEXT`);
        console.log('[Migration 004] Added planning_spec');
      }

      // Add planning_agents column (stores generated agents JSON)
      if (!tasksInfo.some(col => col.name === 'planning_agents')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_agents TEXT`);
        console.log('[Migration 004] Added planning_agents');
      }
    }
  },
  {
    id: '005',
    name: 'add_agent_model_field',
    up: (db) => {
      console.log('[Migration 005] Adding model field to agents...');

      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];

      // Add model column
      if (!agentsInfo.some(col => col.name === 'model')) {
        db.exec(`ALTER TABLE agents ADD COLUMN model TEXT`);
        console.log('[Migration 005] Added model to agents');
      }
    }
  },
  {
    id: '006',
    name: 'add_planning_dispatch_error_column',
    up: (db) => {
      console.log('[Migration 006] Adding planning_dispatch_error column to tasks...');

      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];

      // Add planning_dispatch_error column
      if (!tasksInfo.some(col => col.name === 'planning_dispatch_error')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN planning_dispatch_error TEXT`);
        console.log('[Migration 006] Added planning_dispatch_error to tasks');
      }
    }
  },
  {
    id: '007',
    name: 'add_agent_registry_columns',
    up: (db) => {
      console.log('[Migration 007] Adding agent registry columns...');

      const agentsInfo = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];

      const columns = [
        { name: 'webhook_url', sql: 'ALTER TABLE agents ADD COLUMN webhook_url TEXT' },
        { name: 'machine_hostname', sql: 'ALTER TABLE agents ADD COLUMN machine_hostname TEXT' },
        { name: 'openclaw_host', sql: 'ALTER TABLE agents ADD COLUMN openclaw_host TEXT' },
        { name: 'poll_interval_ms', sql: 'ALTER TABLE agents ADD COLUMN poll_interval_ms INTEGER DEFAULT 30000' },
        { name: 'capabilities', sql: 'ALTER TABLE agents ADD COLUMN capabilities TEXT' },
        { name: 'last_heartbeat', sql: 'ALTER TABLE agents ADD COLUMN last_heartbeat TEXT' },
      ];

      for (const col of columns) {
        if (!agentsInfo.some(c => c.name === col.name)) {
          try {
            db.exec(col.sql);
            console.log(`[Migration 007] Added ${col.name} to agents`);
          } catch (e) {
            console.log(`[Migration 007] Column ${col.name} may already exist`);
          }
        }
      }
    }
  },
  {
    id: '008',
    name: 'mission_control_enhancements',
    up: (db) => {
      console.log('[Migration 008] Adding Mission Control enhancements...');

      // Add tier columns to tasks
      const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      
      if (!tasksInfo.some(col => col.name === 'tier')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN tier TEXT DEFAULT 'manager'`);
        console.log('[Migration 008] Added tier to tasks');
      }
      if (!tasksInfo.some(col => col.name === 'manager_id')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN manager_id TEXT`);
        console.log('[Migration 008] Added manager_id to tasks');
      }
      if (!tasksInfo.some(col => col.name === 'subagent_type')) {
        db.exec(`ALTER TABLE tasks ADD COLUMN subagent_type TEXT`);
        console.log('[Migration 008] Added subagent_type to tasks');
      }

      // Create content_items table
      db.exec(`
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
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_stage ON content_items(stage)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_content_items_platform ON content_items(platform)`);
      console.log('[Migration 008] Created content_items table');

      // Create calendar_events table
      db.exec(`
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
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_time)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_calendar_events_agent ON calendar_events(agent_id)`);
      console.log('[Migration 008] Created calendar_events table');

      // Create team_members table
      db.exec(`
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
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_team_members_tier ON team_members(tier)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_team_members_manager ON team_members(manager_id)`);
      console.log('[Migration 008] Created team_members table');

      // Create memory_files table
      db.exec(`
        CREATE TABLE IF NOT EXISTS memory_files (
          id TEXT PRIMARY KEY,
          agent_id TEXT NOT NULL,
          filename TEXT NOT NULL,
          path TEXT NOT NULL,
          content TEXT,
          cached_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (agent_id) REFERENCES team_members(id)
        );
      `);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_memory_files_agent ON memory_files(agent_id)`);
      console.log('[Migration 008] Created memory_files table');

      // Create indexes for tasks tier columns
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_tier ON tasks(tier)`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_manager ON tasks(manager_id)`);
      
      console.log('[Migration 008] Mission Control enhancements complete');
    }
  }
];

/**
 * Run all pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
  
  // Get already applied migrations
  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: string }[]).map(m => m.id)
  );
  
  // Run pending migrations in order
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    
    console.log(`[DB] Running migration ${migration.id}: ${migration.name}`);
    
    try {
      // Run migration in a transaction
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
      })();
      
      console.log(`[DB] Migration ${migration.id} completed`);
    } catch (error) {
      console.error(`[DB] Migration ${migration.id} failed:`, error);
      throw error;
    }
  }
}

/**
 * Get migration status
 */
export function getMigrationStatus(db: Database.Database): { applied: string[]; pending: string[] } {
  const applied = (db.prepare('SELECT id FROM _migrations ORDER BY id').all() as { id: string }[]).map(m => m.id);
  const pending = migrations.filter(m => !applied.includes(m.id)).map(m => m.id);
  return { applied, pending };
}
