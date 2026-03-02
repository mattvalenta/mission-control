import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { triggerAutoDispatch } from '@/lib/auto-dispatch';

/**
 * POST /api/tasks/[id]/planning/retry-dispatch - Retry auto-dispatch
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (!task.planning_complete) return NextResponse.json({ error: 'Cannot retry dispatch: planning is not complete' }, { status: 400 });
    if (!task.assigned_agent_id) return NextResponse.json({ error: 'Cannot retry dispatch: no agent assigned' }, { status: 400 });

    const agent = await queryOne<{ name: string }>('SELECT name FROM agents WHERE id = $1', [task.assigned_agent_id]);

    const result = await triggerAutoDispatch({
      taskId: task.id,
      taskTitle: task.title,
      agentId: task.assigned_agent_id,
      agentName: agent?.name || 'Unknown Agent',
      workspaceId: task.workspace_id
    });

    if (result.success) {
      await run(`UPDATE tasks SET status = 'inbox', planning_dispatch_error = NULL, updated_at = NOW() WHERE id = $1`, [taskId]);
      return NextResponse.json({ success: true, message: 'Dispatch retry successful' });
    } else {
      await run(`UPDATE tasks SET planning_dispatch_error = $1, status = 'pending_dispatch', updated_at = NOW() WHERE id = $2`, [result.error, taskId]);
      return NextResponse.json({ error: 'Dispatch retry failed', details: result.error }, { status: 500 });
    }
  } catch (error) {
    console.error('Failed to retry dispatch:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await run(`UPDATE tasks SET planning_dispatch_error = $1, updated_at = NOW() WHERE id = $2`, [`Retry error: ${errorMessage}`, taskId]);
    return NextResponse.json({ error: 'Failed to retry dispatch', details: errorMessage }, { status: 500 });
  }
}
