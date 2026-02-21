import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// Webhook token for authentication
const WEBHOOK_TOKEN = 'mc-planning-webhook-secret';

// POST /api/planning-webhook - Skippy injects questions directly
// This bypasses shell quoting issues by accepting a clean JSON payload
export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (token !== WEBHOOK_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taskId, question, options } = body;

    if (!taskId || !question || !options || !Array.isArray(options)) {
      return NextResponse.json({ 
        error: 'taskId, question, and options array are required' 
      }, { status: 400 });
    }

    const task = queryOne<{
      id: string;
      planning_messages?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get existing messages
    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];

    // Add the assistant's question
    const assistantMessage = {
      role: 'assistant',
      content: JSON.stringify({ question, options }),
      timestamp: Date.now(),
    };
    messages.push(assistantMessage);

    // Update the task
    run(
      'UPDATE tasks SET planning_messages = ? WHERE id = ?',
      [JSON.stringify(messages), taskId]
    );

    // Broadcast update via SSE
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Question injected successfully',
      currentQuestion: { question, options },
    });
  } catch (error) {
    console.error('Planning webhook error:', error);
    return NextResponse.json({ error: 'Failed to inject question' }, { status: 500 });
  }
}
