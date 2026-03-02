import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agent/report-progress - Report task progress (from remote agent)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.task_id || !body.agent_id || !body.status) {
      return NextResponse.json({ error: 'Missing required fields: task_id, agent_id, status' }, { status: 400 });
    }
    
    const validStatuses = ['inbox', 'planning', 'assigned', 'in_progress', 'testing', 'review', 'done'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }
    
    // Update task
    const task = await queryOne<any>(`
      UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [body.status, body.task_id]);
    
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    
    // Log activity
    const activityId = uuidv4();
    await run(`
      INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [activityId, body.task_id, body.agent_id, 'status_changed', body.message || `Status changed to ${body.status}`]);
    
    // Update agent status
    if (body.status === 'in_progress') {
      await run(`UPDATE agents SET status = 'working', updated_at = NOW() WHERE id = $1`, [body.agent_id]);
    } else if (body.status === 'done' || body.status === 'review') {
      await run(`UPDATE agents SET status = 'standby', updated_at = NOW() WHERE id = $1`, [body.agent_id]);
    }
    
    // Notify via agent_messages
    await run(`
      INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [body.agent_id, 'mission-control', `TASK PROGRESS: ${body.task_id} is now ${body.status}. ${body.message || ''}`, body.task_id, 'pending']);
    
    return NextResponse.json({ success: true, task, activity_id: activityId });
  } catch (error) {
    console.error('Failed to report progress:', error);
    return NextResponse.json({ error: 'Failed to report progress' }, { status: 500 });
  }
}
