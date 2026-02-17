import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * GET /api/agent/view-tasks
 * View tasks (for remote agents)
 * 
 * Query params:
 * - agent_id: Filter by assigned agent
 * - status: Filter by status (comma-separated for multiple)
 * - limit: Max results (default 100)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let query = `
      SELECT 
        t.*,
        a.name as assigned_agent_name,
        ca.name as created_by_agent_name
      FROM mc_tasks t
      LEFT JOIN mc_agents a ON t.assigned_agent_id = a.id
      LEFT JOIN mc_agents ca ON t.created_by_agent_id = ca.id
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (agentId) {
      params.push(agentId);
      query += ` AND t.assigned_agent_id = $${params.length}`;
    }
    
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        params.push(statuses[0]);
        query += ` AND t.status = $${params.length}`;
      } else if (statuses.length > 1) {
        query += ` AND t.status IN (${statuses.map((_, i) => `$${params.length + i + 1}`).join(',')})`;
        params.push(...statuses);
      }
    }
    
    query += ` ORDER BY t.updated_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    
    const result = await pool.query(query, params);
    
    // Transform to include nested agent info
    const tasks = result.rows.map((task: any) => ({
      ...task,
      assigned_agent: task.assigned_agent_id ? {
        id: task.assigned_agent_id,
        name: task.assigned_agent_name
      } : null,
      created_by: task.created_by_agent_id ? {
        id: task.created_by_agent_id,
        name: task.created_by_agent_name
      } : null
    }));
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
