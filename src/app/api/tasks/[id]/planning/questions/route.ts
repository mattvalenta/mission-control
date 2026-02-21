import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/planning/questions
 * 
 * Called by Skippy to submit generated questions
 * This is the endpoint Skippy POSTs to after generating questions
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

    const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: string;
      planning_messages?: string;
    } | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get existing messages
    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];

    // Replace waiting message with actual questions
    const filteredMessages = messages.filter(
      (m: { role: string; type?: string }) => 
        !(m.role === 'system' && m.type === 'waiting_for_questions')
    );

    // Add batch questions
    filteredMessages.push({
      role: 'system',
      type: 'batch_questions',
      questions,
      timestamp: Date.now()
    });

    // Update task
    getDb().prepare(`
      UPDATE tasks
      SET planning_messages = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(filteredMessages), taskId);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Added ${questions.length} questions to planning session`,
      questionsCount: questions.length
    });
  } catch (error) {
    console.error('Failed to add planning questions:', error);
    return NextResponse.json({ 
      error: 'Failed to add planning questions: ' + (error as Error).message 
    }, { status: 500 });
  }
}
