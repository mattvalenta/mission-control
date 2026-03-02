import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/planning/questions - Submit generated questions
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { questions } = body;

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({ error: 'Questions array required' }, { status: 400 });
    }

    const task = await queryOne<{ id: string; planning_messages?: string }>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    const filteredMessages = messages.filter((m: any) => !(m.role === 'system' && m.type === 'waiting_for_questions'));
    filteredMessages.push({ role: 'system', type: 'batch_questions', questions, timestamp: Date.now() });

    await run('UPDATE tasks SET planning_messages = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(filteredMessages), taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    return NextResponse.json({ success: true, message: `Added ${questions.length} questions`, questionsCount: questions.length });
  } catch (error) {
    console.error('Failed to add planning questions:', error);
    return NextResponse.json({ error: 'Failed to add planning questions: ' + (error as Error).message }, { status: 500 });
  }
}
