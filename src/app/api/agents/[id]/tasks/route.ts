import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from '@/lib/types';

/**
 * GET /api/agents/[id]/tasks - Get assigned tasks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    await run('UPDATE agents SET last_heartbeat = NOW(), status = $1 WHERE id = $2', ['standby', agentId]);

    const tasks = await queryAll(`
      SELECT id, title, description, status, priority, planning_spec, created_at
      FROM tasks WHERE assigned_agent_id = $1 AND status NOT IN ('done', 'cancelled') ORDER BY priority DESC, created_at ASC
    `, [agentId]);

    return NextResponse.json({ success: true, tasks, count: tasks.length });
  } catch (error) {
    console.error('Failed to get agent tasks:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}

/**
 * POST /api/agents/[id]/tasks - Claim or update tasks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const body = await request.json();
    const { action, task_id, status, message } = body;

    if (!action) return NextResponse.json({ error: 'Action required' }, { status: 400 });

    switch (action) {
      case 'claim':
        if (!task_id) return NextResponse.json({ error: 'task_id required for claim' }, { status: 400 });
        
        const task = await queryOne<{ assigned_agent_id: string | null; status: string }>('SELECT assigned_agent_id, status FROM tasks WHERE id = $1', [task_id]);
        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        if (task.assigned_agent_id && task.assigned_agent_id !== agentId) return NextResponse.json({ error: 'Task already claimed' }, { status: 409 });

        await run(`UPDATE tasks SET assigned_agent_id = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2`, [agentId, task_id]);
        await run(`UPDATE agents SET status = 'working', updated_at = NOW() WHERE id = $1`, [agentId]);
        await run(`INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at) VALUES ($1, $2, $3, 'claimed', $4, NOW())`,
          [uuidv4(), task_id, agentId, message || 'Agent claimed task']);

        const updatedTask = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [task_id]);
        if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

        return NextResponse.json({ success: true, message: 'Task claimed successfully', task: updatedTask });

      case 'update':
        if (!task_id) return NextResponse.json({ error: 'task_id required for update' }, { status: 400 });

        if (status) await run('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [status, task_id]);
        if (message) await run(`INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at) VALUES ($1, $2, $3, 'progress', $4, NOW())`,
          [uuidv4(), task_id, agentId, message]);

        const task2 = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [task_id]);
        if (task2) broadcast({ type: 'task_updated', payload: task2 });

        return NextResponse.json({ success: true, message: 'Task updated' });

      case 'complete':
        if (!task_id) return NextResponse.json({ error: 'task_id required for complete' }, { status: 400 });

        await run(`UPDATE tasks SET status = 'review', updated_at = NOW() WHERE id = $1`, [task_id]);
        await run(`INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at) VALUES ($1, $2, $3, 'completed', $4, NOW())`,
          [uuidv4(), task_id, agentId, message || 'Task completed']);
        await run(`UPDATE agents SET status = 'standby', updated_at = NOW() WHERE id = $1`, [agentId]);

        const task3 = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [task_id]);
        if (task3) broadcast({ type: 'task_updated', payload: task3 });

        return NextResponse.json({ success: true, message: 'Task marked complete' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to process agent action:', error);
    return NextResponse.json({ error: 'Failed to process action: ' + (error as Error).message }, { status: 500 });
  }
}
