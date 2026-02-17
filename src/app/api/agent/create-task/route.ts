import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * POST /api/agent/create-task
 * Create a new task (from remote agent)
 * 
 * Body:
 * - title: string (required)
 * - description: string (optional)
 * - assigned_agent_id: string (optional)
 * - created_by_agent_id: string (required)
 * - priority: string (optional, default: 'normal')
 * - workspace_id: string (optional, default: 'default')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.title || !body.created_by_agent_id) {
      return NextResponse.json(
        { error: 'Missing required fields: title, created_by_agent_id' },
        { status: 400 }
      );
    }
    
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const result = await pool.query(`
      INSERT INTO mc_tasks (
        id, title, description, status, priority,
        assigned_agent_id, created_by_agent_id, workspace_id,
        created_at, updated_at, source_machine
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      id,
      body.title,
      body.description || null,
      body.status || 'inbox',
      body.priority || 'normal',
      body.assigned_agent_id || null,
      body.created_by_agent_id,
      body.workspace_id || 'default',
      now,
      now,
      body.source_machine || 'remote-agent'
    ]);
    
    // Notify Mission Control to sync
    await pool.query(`
      INSERT INTO agent_messages (from_agent, to_agent, content, status, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      body.created_by_agent_id,
      'mission-control',
      `NEW TASK CREATED: ${body.title} (ID: ${id})${body.assigned_agent_id ? ` assigned to ${body.assigned_agent_id}` : ''}`,
      'pending',
      now
    ]);
    
    // If assigned to a specific agent, notify them too
    if (body.assigned_agent_id && body.assigned_agent_id !== body.created_by_agent_id) {
      await pool.query(`
        INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        body.created_by_agent_id,
        body.assigned_agent_id,
        `TASK ASSIGNED: ${body.title}\n\n${body.description || 'No description'}\n\nTask ID: ${id}\nPriority: ${body.priority || 'normal'}`,
        id,
        'pending',
        now
      ]);
    }
    
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
