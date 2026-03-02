import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

/**
 * GET /api/agent/view-tasks - View tasks (for remote agents)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let query = `
      SELECT t.*, a.name as assigned_agent_name, ca.name as created_by_agent_name
      FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id
      LEFT JOIN agents ca ON t.created_by_agent_id = ca.id WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;
    
    if (agentId) {
      query += ` AND t.assigned_agent_id = $${paramIndex++}`;
      params.push(agentId);
    }
    
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query += ` AND t.status = $${paramIndex++}`;
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        query += ` AND t.status IN (${statuses.map(() => `$${paramIndex++}`).join(',')})`;
        params.push(...statuses);
      }
    }
    
    query += ` ORDER BY t.updated_at DESC LIMIT $${paramIndex}`;
    params.push(limit);
    
    const tasks = await queryAll<any>(query, params);
    
    const transformed = tasks.map((task: any) => ({
      ...task,
      assigned_agent: task.assigned_agent_id ? { id: task.assigned_agent_id, name: task.assigned_agent_name } : null,
      created_by: task.created_by_agent_id ? { id: task.created_by_agent_id, name: task.created_by_agent_name } : null
    }));
    
    return NextResponse.json(transformed);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
