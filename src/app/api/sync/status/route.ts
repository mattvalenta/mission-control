import { NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * GET /api/sync/status
 * Check sync service status and PostgreSQL connection
 */
export async function GET() {
  const status = {
    postgres_url: !!process.env.POSTGRES_URL,
    machine_hostname: process.env.MACHINE_HOSTNAME || 'not set',
    master_controller: process.env.MASTER_CONTROLLER_AGENT || 'skippy',
    tables: {} as Record<string, number>,
    connection: false,
    error: null as string | null
  };
  
  try {
    // Test PostgreSQL connection
    await pool.query('SELECT NOW()');
    status.connection = true;
    
    // Count rows in each table
    const tables = ['mc_tasks', 'mc_agents', 'clarification_queue', 'agent_messages', 'task_activities'];
    
    for (const table of tables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        status.tables[table] = parseInt(result.rows[0].count);
      } catch {
        status.tables[table] = -1; // Table doesn't exist
      }
    }
  } catch (error) {
    status.error = (error as Error).message;
  }
  
  return NextResponse.json(status);
}
