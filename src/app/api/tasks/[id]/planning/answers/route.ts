import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/planning/answers - Submit agent planning answers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Answers array required' }, { status: 400 });
    }

    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (task.planning_stage !== 'agent_planning') {
      return NextResponse.json({ error: 'Task is not in agent planning phase', currentStage: task.planning_stage }, { status: 400 });
    }

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    for (const answer of answers) {
      messages.push({ role: 'assistant', agentId: '3a90091a-a6e5-4abc-934e-117210d07d73', questionId: answer.questionId, content: answer.answer, timestamp: Date.now() });
    }
    messages.push({ role: 'system', type: 'agent_planning_complete', timestamp: Date.now() });

    await run(`
      UPDATE tasks SET planning_messages = $1, planning_stage = 'complete', status = 'in_progress', updated_at = NOW() WHERE id = $2
    `, [JSON.stringify(messages), taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    await run(`INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [crypto.randomUUID(), taskId, '3a90091a-a6e5-4abc-934e-117210d07d73', 'status_changed', 'Skippy answered agent planning questions. Task ready for execution.']);

    return NextResponse.json({ success: true, message: 'Agent planning complete.', answersSubmitted: answers.length, status: 'in_progress' });
  } catch (error) {
    console.error('Failed to submit agent planning answers:', error);
    return NextResponse.json({ error: 'Failed to submit answers: ' + (error as Error).message }, { status: 500 });
  }
}
