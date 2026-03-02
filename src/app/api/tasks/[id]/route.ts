import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { getMissionControlUrl } from '@/lib/config';
import { UpdateTaskSchema } from '@/lib/validation';
import type { Task, UpdateTaskRequest, Agent } from '@/lib/types';

// GET /api/tasks/[id] - Get a single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await queryOne<Task>(
      `SELECT t.*, aa.name as assigned_agent_name, aa.avatar_emoji as assigned_agent_emoji
       FROM tasks t LEFT JOIN agents aa ON t.assigned_agent_id = aa.id WHERE t.id = $1`,
      [id]
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to fetch task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - Update a task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateTaskRequest & { updated_by_agent_id?: string } = await request.json();

    const validation = UpdateTaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });
    }

    const validatedData = validation.data;
    const existing = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (validatedData.status === 'done' && existing.status === 'review' && validatedData.updated_by_agent_id) {
      const updatingAgent = await queryOne<Agent>('SELECT is_master FROM agents WHERE id = $1', [validatedData.updated_by_agent_id]);
      if (!updatingAgent || !updatingAgent.is_master) {
        return NextResponse.json({ error: 'Forbidden: only the master agent can approve tasks' }, { status: 403 });
      }
    }

    if (validatedData.title !== undefined) { updates.push(`title = $${paramIndex++}`); values.push(validatedData.title); }
    if (validatedData.description !== undefined) { updates.push(`description = $${paramIndex++}`); values.push(validatedData.description); }
    if (validatedData.priority !== undefined) { updates.push(`priority = $${paramIndex++}`); values.push(validatedData.priority); }
    if (validatedData.due_date !== undefined) { updates.push(`due_date = $${paramIndex++}`); values.push(validatedData.due_date); }

    let shouldDispatch = false;

    if (validatedData.status !== undefined && validatedData.status !== existing.status) {
      updates.push(`status = $${paramIndex++}`);
      values.push(validatedData.status);
      if (validatedData.status === 'assigned' && existing.assigned_agent_id) shouldDispatch = true;
      const eventType = validatedData.status === 'done' ? 'task_completed' : 'task_status_changed';
      await run(`INSERT INTO events (id, type, task_id, message, created_at) VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), eventType, id, `Task "${existing.title}" moved to ${validatedData.status}`]);
    }

    if (validatedData.assigned_agent_id !== undefined && validatedData.assigned_agent_id !== existing.assigned_agent_id) {
      updates.push(`assigned_agent_id = $${paramIndex++}`);
      values.push(validatedData.assigned_agent_id);
      if (validatedData.assigned_agent_id) {
        const agent = await queryOne<Agent>('SELECT name FROM agents WHERE id = $1', [validatedData.assigned_agent_id]);
        if (agent) {
          await run(`INSERT INTO events (id, type, agent_id, task_id, message, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
            [uuidv4(), 'task_assigned', validatedData.assigned_agent_id, id, `"${existing.title}" assigned to ${agent.name}`]);
          if (existing.status === 'assigned' || validatedData.status === 'assigned') shouldDispatch = true;
        }
      }
    }

    if (updates.length === 0) return NextResponse.json({ error: 'No updates provided' }, { status: 400 });

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

    const task = await queryOne<Task>(
      `SELECT t.*, aa.name as assigned_agent_name, aa.avatar_emoji as assigned_agent_emoji, ca.name as created_by_agent_name
       FROM tasks t LEFT JOIN agents aa ON t.assigned_agent_id = aa.id LEFT JOIN agents ca ON t.created_by_agent_id = ca.id WHERE t.id = $1`,
      [id]);

    if (task) broadcast({ type: 'task_updated', payload: task });

    if (shouldDispatch) {
      fetch(`${getMissionControlUrl()}/api/tasks/${id}/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).catch(console.error);
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to update task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [id]);
    if (!existing) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    await run('DELETE FROM openclaw_sessions WHERE task_id = $1', [id]);
    await run('DELETE FROM events WHERE task_id = $1', [id]);
    await run('UPDATE conversations SET task_id = NULL WHERE task_id = $1', [id]);
    await run('DELETE FROM tasks WHERE id = $1', [id]);

    broadcast({ type: 'task_deleted', payload: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
