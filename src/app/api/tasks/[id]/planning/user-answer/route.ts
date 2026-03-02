import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/tasks/[id]/planning/user-answer - User submits answer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answer, otherText } = body;

    if (!answer) return NextResponse.json({ error: 'Answer is required' }, { status: 400 });

    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    messages.push({ role: 'user', content: otherText ? `${answer}: ${otherText}` : answer, timestamp: Date.now() });

    await run('UPDATE tasks SET planning_messages = $1 WHERE id = $2', [JSON.stringify(messages), taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    // Trigger Skippy
    fetch('http://127.0.0.1:18789/hooks/wake', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer mc-planning-webhook-secret', 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `PLANNING ANSWER for task "${task.title}" (ID: ${taskId})\n\nUser answered: "${otherText ? `${answer}: ${otherText}` : answer}"\n\nGenerate next question.`, mode: 'now' }),
    }).catch(console.error);

    return NextResponse.json({ success: true, message: 'Answer submitted.', answer: otherText ? `${answer}: ${otherText}` : answer });
  } catch (error) {
    console.error('Failed to submit user answer:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}
