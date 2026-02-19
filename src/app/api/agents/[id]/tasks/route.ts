import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne, queryAll, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from '@/lib/types';

/**
 * GET /api/agents/[id]/tasks
 * 
 * Agents poll this to get their assigned tasks.
 * Returns pending/in-progress tasks for this agent.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    // Update heartbeat
    run('UPDATE agents SET last_heartbeat = ?, status = ? WHERE id = ?', [
      new Date().toISOString(),
      'standby',
      agentId
    ]);

    // Get tasks assigned to this agent that are not completed
    const tasks = queryAll(`
      SELECT id, title, description, status, priority, planning_spec, created_at
      FROM tasks
      WHERE assigned_agent_id = ?
      AND status NOT IN ('done', 'cancelled')
      ORDER BY priority DESC, created_at ASC
    `, [agentId]);

    return NextResponse.json({
      success: true,
      tasks,
      count: tasks.length
    });
  } catch (error) {
    console.error('Failed to get agent tasks:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}

/**
 * POST /api/agents/[id]/tasks
 * 
 * Agent claims a specific task or reports status update.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: agentId } = await params;

  try {
    const body = await request.json();
    const { action, task_id, status, message, progress } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'claim':
        // Claim a specific task
        if (!task_id) {
          return NextResponse.json({ error: 'task_id required for claim' }, { status: 400 });
        }
        
        // Check if task is already claimed
        const task = queryOne<{ assigned_agent_id: string | null; status: string }>(
          'SELECT assigned_agent_id, status FROM tasks WHERE id = ?',
          [task_id]
        );
        
        if (!task) {
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        
        if (task.assigned_agent_id && task.assigned_agent_id !== agentId) {
          return NextResponse.json({ error: 'Task already claimed by another agent' }, { status: 409 });
        }

        // Claim the task
        run(`
          UPDATE tasks SET 
            assigned_agent_id = ?,
            status = 'in_progress',
            updated_at = ?
          WHERE id = ?
        `, [agentId, now, task_id]);

        // Update agent status
        run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?', ['working', now, agentId]);

        // Log activity
        run(`
          INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
          VALUES (?, ?, ?, 'claimed', ?, ?)
        `, [uuidv4(), task_id, agentId, message || 'Agent claimed task', now]);

        // Broadcast update
        const updatedTask = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [task_id]);
        if (updatedTask && updatedTask.id) {
          broadcast({ type: 'task_updated', payload: updatedTask });
        }

        return NextResponse.json({
          success: true,
          message: 'Task claimed successfully',
          task: updatedTask
        });

      case 'update':
        // Update task status/progress
        if (!task_id) {
          return NextResponse.json({ error: 'task_id required for update' }, { status: 400 });
        }

        if (status) {
          run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, task_id]);
        }

        if (message) {
          run(`
            INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
            VALUES (?, ?, ?, 'progress', ?, ?)
          `, [uuidv4(), task_id, agentId, message, now]);
        }

        // Broadcast update
        const task2 = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [task_id]);
        if (task2 && task2.id) {
          broadcast({ type: 'task_updated', payload: task2 });
        }

        return NextResponse.json({ success: true, message: 'Task updated' });

      case 'complete':
        // Mark task as complete
        if (!task_id) {
          return NextResponse.json({ error: 'task_id required for complete' }, { status: 400 });
        }

        run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', ['review', now, task_id]);
        
        // Log completion
        run(`
          INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
          VALUES (?, ?, ?, 'completed', ?, ?)
        `, [uuidv4(), task_id, agentId, message || 'Task completed', now]);

        // Update agent back to standby
        run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?', ['standby', now, agentId]);

        // Broadcast update
        const task3 = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [task_id]);
        if (task3 && task3.id) {
          broadcast({ type: 'task_updated', payload: task3 });
        }

        return NextResponse.json({ success: true, message: 'Task marked complete' });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to process agent action:', error);
    return NextResponse.json({ error: 'Failed to process action: ' + (error as Error).message }, { status: 500 });
  }
}
