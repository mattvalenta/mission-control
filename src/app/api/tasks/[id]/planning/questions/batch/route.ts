import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { sendPlanningRequest, isClawgUIConfigured } from '@/lib/clawg-ui-client';

const SKIPPY_AGENT_ID = '3a90091a-a6e5-4abc-934e-117210d07d73';

// POST /api/tasks/[id]/planning/questions/batch - Generate all questions upfront
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (task.planning_messages) {
      const existing = JSON.parse(task.planning_messages);
      const batchData = existing.find((m: any) => m.role === 'system' && m.type === 'batch_questions');
      if (batchData) {
        return NextResponse.json({ success: true, questions: batchData.questions, answers: existing.filter((m: any) => m.role === 'user').map((m: any) => ({ questionId: m.questionId, answer: m.content })), message: 'Questions already generated' });
      }
    }

    const waitingMessages = [{ role: 'system', type: 'waiting_for_questions', timestamp: Date.now() }];
    const sessionKey = `batch-planning:${taskId}`;
    const isUserPlanning = task.assigned_agent_id === SKIPPY_AGENT_ID || !task.assigned_agent_id;
    const planningStage = isUserPlanning ? 'user_planning' : 'agent_planning';

    await run(`UPDATE tasks SET planning_session_key = $1, planning_messages = $2, planning_stage = $3, status = 'planning' WHERE id = $4`,
      [sessionKey, JSON.stringify(waitingMessages), planningStage, taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    if (!isClawgUIConfigured()) {
      try {
        await fetch('http://127.0.0.1:18789/hooks/wake', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer mc-planning-webhook-secret', 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: `GENERATE_BATCH_QUESTIONS for task "${taskId}"\n\nTask Title: "${task.title}"\nTask Description: "${task.description}"\n\nGenerate up to 10 simple clarifying questions. POST to http://localhost:4000/api/tasks/${taskId}/planning/questions`, mode: 'now' }),
        });
      } catch (webhookError) { console.error('[Batch Planning] Wake webhook error:', webhookError); }
    } else {
      sendPlanningRequest(taskId, task.title, task.description, 'generate_questions').catch(err => console.error('[Batch Planning] clawg-ui error:', err));
    }

    return NextResponse.json({ success: true, questions: null, answers: [], status: 'generating', message: 'Requesting questions from Skippy.' });
  } catch (error) {
    console.error('Failed to generate batch questions:', error);
    return NextResponse.json({ error: 'Failed to generate batch questions: ' + (error as Error).message }, { status: 500 });
  }
}

// PATCH /api/tasks/[id]/planning/questions/batch - Submit all answers at once
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) return NextResponse.json({ error: 'Answers array required' }, { status: 400 });

    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    for (const answer of answers) {
      messages.push({ role: 'user', questionId: answer.questionId, content: answer.answer, timestamp: Date.now() });
    }
    messages.push({ role: 'system', type: 'batch_complete', timestamp: Date.now() });

    await run('UPDATE tasks SET planning_messages = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(messages), taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    return NextResponse.json({ success: true, message: 'Answers submitted.', answersSubmitted: answers.length });
  } catch (error) {
    console.error('Failed to submit batch answers:', error);
    return NextResponse.json({ error: 'Failed to submit batch answers: ' + (error as Error).message }, { status: 500 });
  }
}

// GET /api/tasks/[id]/planning/questions/batch - Get current batch state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (!task.planning_messages) return NextResponse.json({ questions: null, answers: [], isComplete: false });

    const messages = JSON.parse(task.planning_messages);
    const isWaiting = messages.some((m: any) => m.role === 'system' && m.type === 'waiting_for_questions');

    if (isWaiting) return NextResponse.json({ questions: null, answers: [], isComplete: false, status: 'generating', planningStage: task.planning_stage });

    const batchData = messages.find((m: any) => m.role === 'system' && m.type === 'batch_questions');
    const answers = messages.filter((m: any) => m.role === 'user').map((m: any) => ({ questionId: m.questionId, answer: m.content }));
    const isComplete = messages.some((m: any) => m.role === 'system' && m.type === 'batch_complete');

    return NextResponse.json({ questions: batchData?.questions || null, answers, isComplete, planningStage: task.planning_stage });
  } catch (error) {
    console.error('Failed to get batch state:', error);
    return NextResponse.json({ error: 'Failed to get batch state' }, { status: 500 });
  }
}
