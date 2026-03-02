import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agent/create-task - Create a new task (from remote agent)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.title || !body.created_by_agent_id) {
      return NextResponse.json({ error: 'Missing required fields: title, created_by_agent_id' }, { status: 400 });
    }
    
    const id = uuidv4();
    
    await run(`
      INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, created_by_agent_id, workspace_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, [
      id, body.title, body.description || null, body.status || 'inbox', body.priority || 'normal',
      body.assigned_agent_id || null, body.created_by_agent_id, body.workspace_id || 'default'
    ]);
    
    // Notify Mission Control
    await run(`
      INSERT INTO agent_messages (from_agent, to_agent, content, status, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [body.created_by_agent_id, 'mission-control', `NEW TASK CREATED: ${body.title} (ID: ${id})`, 'pending']);
    
    // If assigned to different agent, notify them
    if (body.assigned_agent_id && body.assigned_agent_id !== body.created_by_agent_id) {
      await run(`
        INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `, [body.created_by_agent_id, body.assigned_agent_id, `TASK ASSIGNED: ${body.title}\n\n${body.description || 'No description'}`, id, 'pending']);
    }
    
    const task = await queryOne('SELECT * FROM tasks WHERE id = $1', [id]);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
