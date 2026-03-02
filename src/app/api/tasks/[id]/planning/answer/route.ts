import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/tasks/[id]/planning/answer - Agent submits a question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { question, options } = body;

    if (!question || !options || !Array.isArray(options)) {
      return NextResponse.json({ error: 'Question and options array required' }, { status: 400 });
    }

    const task = await queryOne<{ id: string; planning_messages?: string }>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    messages.push({ role: 'assistant', content: JSON.stringify({ question, options }), timestamp: Date.now() });

    await run('UPDATE tasks SET planning_messages = $1 WHERE id = $2', [JSON.stringify(messages), taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    return NextResponse.json({ success: true, message: 'Question added', currentQuestion: { question, options } });
  } catch (error) {
    console.error('Failed to add planning answer:', error);
    return NextResponse.json({ error: 'Failed to add planning answer' }, { status: 500 });
  }
}
