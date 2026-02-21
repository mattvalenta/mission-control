import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/tasks/[id]/planning/complete - Mark planning complete (Stage 2)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = queryOne<{
      id: string;
      title: string;
      planning_stage?: string;
      assigned_agent_id?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get agent info
    const agent = task.assigned_agent_id 
      ? queryOne<{ name: string }>('SELECT name FROM agents WHERE id = ?', [task.assigned_agent_id])
      : null;

    // Update task to mark planning complete
    run(`
      UPDATE tasks
      SET planning_stage = 'complete',
          planning_complete = 1,
          status = 'assigned',
          updated_at = datetime('now')
      WHERE id = ?
    `, [taskId]);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });

      // Add event for the feed
      run(`
        INSERT INTO events (id, type, task_id, message, created_at)
        VALUES (?, 'planning_complete', ?, ?, datetime('now'))
      `, [crypto.randomUUID(), taskId, `Planning complete. ${agent?.name || 'Agent'} ready to execute.`]);
    }

    return NextResponse.json({
      success: true,
      message: 'Planning complete. Ready for execution.',
      planningStage: 'complete',
    });
  } catch (error) {
    console.error('Failed to complete planning:', error);
    return NextResponse.json({ error: 'Failed to complete planning' }, { status: 500 });
  }
}
