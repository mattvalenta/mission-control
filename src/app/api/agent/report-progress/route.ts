import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';

const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

/**
 * POST /api/agent/report-progress
 * Report task progress (from remote agent)
 * 
 * Body:
 * - task_id: string (required)
 * - agent_id: string (required)
 * - status: string (required)
 * - message: string (optional)
 * - deliverables: array (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.task_id || !body.agent_id || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: task_id, agent_id, status' },
        { status: 400 }
      );
    }
    
    const validStatuses = ['inbox', 'planning', 'assigned', 'in_progress', 'testing', 'review', 'done'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Update task
    const taskResult = await pool.query(`
      UPDATE mc_tasks 
      SET status = $1, 
          updated_at = NOW(),
          deliverables = COALESCE($2, deliverables)
      WHERE id = $3
      RETURNING *
    `, [
      body.status, 
      body.deliverables ? JSON.stringify(body.deliverables) : null, 
      body.task_id
    ]);
    
    if (taskResult.rows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Log activity
    const activityId = uuidv4();
    await pool.query(`
      INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      activityId, 
      body.task_id, 
      body.agent_id, 
      'status_changed', 
      body.message || `Status changed to ${body.status}`
    ]);
    
    // Update agent status if task is in_progress
    if (body.status === 'in_progress') {
      await pool.query(`
        UPDATE mc_agents SET status = 'working', updated_at = NOW() WHERE id = $1
      `, [body.agent_id]);
    } else if (body.status === 'done' || body.status === 'review') {
      await pool.query(`
        UPDATE mc_agents SET status = 'standby', updated_at = NOW() WHERE id = $1
      `, [body.agent_id]);
    }
    
    // Notify Mission Control via agent_messages
    await pool.query(`
      INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      body.agent_id,
      'mission-control',
      `TASK PROGRESS: ${body.task_id} is now ${body.status}. ${body.message || ''}`,
      body.task_id,
      'pending'
    ]);
    
    return NextResponse.json({
      success: true,
      task: taskResult.rows[0],
      activity_id: activityId
    });
  } catch (error) {
    console.error('Failed to report progress:', error);
    return NextResponse.json({ error: 'Failed to report progress' }, { status: 500 });
  }
}
