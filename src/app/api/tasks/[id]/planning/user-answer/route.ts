import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// POST /api/tasks/[id]/planning/user-answer - User submits their answer to a question
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answer, otherText } = body;

    if (!answer) {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 });
    }

    const task = queryOne<{
      id: string;
      title: string;
      description: string;
      planning_messages?: string;
      planning_stage?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get existing messages
    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];

    // Add the user's answer as a new message
    const userMessage = {
      role: 'user',
      content: otherText ? `${answer}: ${otherText}` : answer,
      timestamp: Date.now(),
    };
    messages.push(userMessage);

    // Update the task
    run(
      'UPDATE tasks SET planning_messages = ? WHERE id = ?',
      [JSON.stringify(messages), taskId]
    );

    // Broadcast update - this triggers SSE to refresh the UI
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    // Trigger Skippy via wake webhook using the CORRECT webhook token
    // Include instructions to use the new /api/planning-webhook endpoint
    fetch('http://127.0.0.1:18789/hooks/wake', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mc-planning-webhook-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: `PLANNING ANSWER for task "${task.title}" (ID: ${taskId})

User answered: "${userMessage.content}"

Generate the NEXT clarifying question (JSON format with question + 4 options).
Then POST it to the new webhook:
POST http://localhost:4000/api/planning-webhook
Authorization: Bearer mc-planning-webhook-secret
Body: {"taskId": "${taskId}", "question": "...", "options": [...]}

Or use sessions_spawn to spawn an agent that makes the HTTP POST.`,
        mode: 'now',
      }),
    }).catch((err) => {
      console.error('[User Answer] Wake webhook error:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'Answer submitted. Question will be generated shortly.',
      answer: userMessage.content,
      questionCount: messages.filter((m: any) => m.role === 'assistant').length,
    });
  } catch (error) {
    console.error('Failed to submit user answer:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}
