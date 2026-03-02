import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/tasks/[id]/planning/complete - Mark planning complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const agent = task.assigned_agent_id
      ? await queryOne<{ name: string }>('SELECT name FROM agents WHERE id = $1', [task.assigned_agent_id])
      : null;

    await run(`
      UPDATE tasks SET planning_stage = 'complete', planning_complete = true, status = 'assigned', updated_at = NOW() WHERE id = $1
    `, [taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) {
      broadcast({ type: 'task_updated', payload: updatedTask });
      await run(`INSERT INTO events (id, type, task_id, message, created_at) VALUES ($1, 'planning_complete', $2, $3, NOW())`,
        [crypto.randomUUID(), taskId, `Planning complete. ${agent?.name || 'Agent'} ready to execute.`]);
    }

    return NextResponse.json({ success: true, message: 'Planning complete.', planningStage: 'complete' });
  } catch (error) {
    console.error('Failed to complete planning:', error);
    return NextResponse.json({ error: 'Failed to complete planning' }, { status: 500 });
  }
}
