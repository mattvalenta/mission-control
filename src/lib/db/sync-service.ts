import pg from 'pg';
import Database from 'better-sqlite3';
import path from 'path';

const { Pool } = pg;

const POSTGRES_URL = process.env.POSTGRES_URL!;
const MACHINE_HOSTNAME = process.env.MACHINE_HOSTNAME || 'localhost';
const OPENCLAW_HOST = process.env.OPENCLAW_HOST || 'localhost';

let pgPool: pg.Pool | null = null;
let syncInterval: NodeJS.Timeout | null = null;

export function getPostgresPool(): pg.Pool {
  if (!pgPool) {
    pgPool = new Pool({ 
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

/**
 * Sync tasks from SQLite to PostgreSQL
 */
export async function syncTasksToPostgres(db: Database.Database): Promise<number> {
  const pool = getPostgresPool();
  const now = new Date().toISOString();

  try {
    // Get all tasks from SQLite
    const tasks = db.prepare(`
      SELECT 
        t.*,
        a.name as assigned_agent_name
      FROM tasks t
      LEFT JOIN agents a ON t.assigned_agent_id = a.id
    `).all() as any[];

    let syncedCount = 0;

    for (const task of tasks) {
      const result = await pool.query(`
        INSERT INTO mc_tasks (
          id, title, description, status, priority,
          assigned_agent_id, created_by_agent_id, workspace_id,
          planning_session_key, planning_complete, planning_spec,
          created_at, updated_at, sqlite_synced_at, source_machine
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          priority = EXCLUDED.priority,
          assigned_agent_id = EXCLUDED.assigned_agent_id,
          planning_complete = EXCLUDED.planning_complete,
          planning_spec = EXCLUDED.planning_spec,
          updated_at = EXCLUDED.updated_at,
          sqlite_synced_at = EXCLUDED.sqlite_synced_at
      `, [
        task.id, 
        task.title, 
        task.description, 
        task.status, 
        task.priority,
        task.assigned_agent_id, 
        task.created_by_agent_id, 
        task.workspace_id || 'default',
        task.planning_session_key, 
        task.planning_complete || 0, 
        task.planning_spec,
        task.created_at, 
        task.updated_at, 
        now, 
        MACHINE_HOSTNAME
      ]);
      
      if (result.rowCount && result.rowCount > 0) {
        syncedCount++;
      }
    }

    return syncedCount;
  } catch (err) {
    console.error('[Sync] Error syncing tasks:', err);
    throw err;
  }
}

/**
 * Sync agents from SQLite to PostgreSQL
 */
export async function syncAgentsToPostgres(db: Database.Database): Promise<number> {
  const pool = getPostgresPool();
  const now = new Date().toISOString();

  try {
    const agents = db.prepare(`SELECT * FROM agents`).all() as any[];

    let syncedCount = 0;

    for (const agent of agents) {
      const result = await pool.query(`
        INSERT INTO mc_agents (
          id, name, role, description, status, is_master,
          workspace_id, machine_hostname, openclaw_url,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          is_master = EXCLUDED.is_master,
          updated_at = EXCLUDED.updated_at
      `, [
        agent.id, 
        agent.name, 
        agent.role, 
        agent.description,
        agent.status || 'standby', 
        agent.is_master || 0, 
        agent.workspace_id || 'default',
        MACHINE_HOSTNAME,
        `ws://${OPENCLAW_HOST}:18789`,
        agent.created_at, 
        agent.updated_at
      ]);
      
      if (result.rowCount && result.rowCount > 0) {
        syncedCount++;
      }
    }

    return syncedCount;
  } catch (err) {
    console.error('[Sync] Error syncing agents:', err);
    throw err;
  }
}

/**
 * Sync task activities to PostgreSQL
 */
export async function syncActivitiesToPostgres(db: Database.Database): Promise<number> {
  const pool = getPostgresPool();

  try {
    const activities = db.prepare(`SELECT * FROM task_activities ORDER BY created_at DESC LIMIT 100`).all() as any[];

    let syncedCount = 0;

    for (const activity of activities) {
      // Check if activity already exists
      const existing = await pool.query(
        'SELECT id FROM task_activities WHERE id = $1',
        [activity.id]
      );

      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO task_activities (
            id, task_id, agent_id, activity_type, message, metadata, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          activity.id,
          activity.task_id,
          activity.agent_id,
          activity.activity_type,
          activity.message,
          activity.metadata,
          activity.created_at
        ]);
        syncedCount++;
      }
    }

    return syncedCount;
  } catch (err) {
    console.error('[Sync] Error syncing activities:', err);
    throw err;
  }
}

/**
 * Full sync of all data
 */
export async function performFullSync(db: Database.Database): Promise<{
  tasks: number;
  agents: number;
  activities: number;
}> {
  console.log('[Sync] Starting full sync...');
  
  const tasks = await syncTasksToPostgres(db);
  const agents = await syncAgentsToPostgres(db);
  const activities = await syncActivitiesToPostgres(db);
  
  console.log(`[Sync] Complete: ${tasks} tasks, ${agents} agents, ${activities} activities`);
  
  return { tasks, agents, activities };
}

/**
 * Start periodic sync service
 */
export function startSyncService(db: Database.Database, intervalMs: number = 5000): NodeJS.Timeout {
  console.log(`[Sync] Starting sync service (interval: ${intervalMs}ms)`);
  
  // Initial sync
  performFullSync(db).catch(err => {
    console.error('[Sync] Initial sync failed:', err);
  });
  
  // Periodic sync
  syncInterval = setInterval(async () => {
    try {
      await performFullSync(db);
    } catch (err) {
      console.error('[Sync] Periodic sync failed:', err);
    }
  }, intervalMs);
  
  return syncInterval;
}

/**
 * Stop sync service
 */
export function stopSyncService(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Sync] Sync service stopped');
  }
}

/**
 * Close PostgreSQL connection
 */
export async function closePostgresConnection(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
    console.log('[Sync] PostgreSQL connection closed');
  }
}
