import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { sendPlanningRequest, isClawgUIConfigured } from '@/lib/clawg-ui-client';

// Skippy's agent ID
const SKIPPY_AGENT_ID = '3a90091a-a6e5-4abc-934e-117210d07d73';

// POST /api/tasks/[id]/planning/questions/batch - Generate all questions upfront
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: string;
      title: string;
      description: string;
      status: string;
      assigned_agent_id?: string;
      planning_session_key?: string;
      planning_messages?: string;
      planning_stage?: string;
    } | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if questions already generated
    if (task.planning_messages) {
      const existing = JSON.parse(task.planning_messages);
      // Check if we have batch questions stored
      const batchData = existing.find((m: { role: string; type?: string }) => 
        m.role === 'system' && m.type === 'batch_questions'
      );
      
      if (batchData) {
        return NextResponse.json({
          success: true,
          questions: batchData.questions,
          answers: existing
            .filter((m: { role: string }) => m.role === 'user')
            .map((m: { content: string; questionId?: string }) => ({
              questionId: m.questionId,
              answer: m.content
            })),
          message: 'Questions already generated'
        });
      }
    }

    // Mark task as waiting for questions from Skippy
    const waitingMessages = [
      {
        role: 'system',
        type: 'waiting_for_questions',
        timestamp: Date.now()
      }
    ];

    // Create session key
    const sessionKey = `batch-planning:${taskId}`;

    // Determine planning stage
    const isUserPlanning = task.assigned_agent_id === SKIPPY_AGENT_ID || !task.assigned_agent_id;
    const planningStage = isUserPlanning ? 'user_planning' : 'agent_planning';

    // Update task to waiting state
    getDb().prepare(`
      UPDATE tasks
      SET planning_session_key = ?,
          planning_messages = ?,
          planning_stage = ?,
          status = 'planning'
      WHERE id = ?
    `).run(sessionKey, JSON.stringify(waitingMessages), planningStage, taskId);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    // Trigger Skippy to generate task-specific questions via clawg-ui
    if (isClawgUIConfigured()) {
      // Use clawg-ui (preferred)
      sendPlanningRequest(taskId, task.title, task.description, 'generate_questions')
        .then(result => console.log('[Batch Planning] Skippy response:', result))
        .catch(err => console.error('[Batch Planning] clawg-ui error:', err));
    } else {
      // Fallback to webhook (legacy)
      try {
        await fetch('http://127.0.0.1:18789/hooks/wake', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mc-planning-webhook-secret',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `GENERATE_BATCH_QUESTIONS for task "${taskId}"

Task Title: "${task.title}"
Task Description: "${task.description}"

Please generate up to 10 SIMPLE clarifying questions for this task. Questions should be:
- Simple, non-technical language (for a "monkey" to understand)
- Multiple choice with 4 options (A, B, C, Other)
- Relevant to the specific task, NOT generic templates

Format as JSON array and POST all questions at once to:
POST http://localhost:4000/api/tasks/${taskId}/planning/questions
Body: {"questions": [...array of question objects...]}`,
            mode: 'now',
          }),
        });
      } catch (webhookError) {
        console.error('[Batch Planning] Wake webhook error:', webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      questions: null,
      answers: [],
      status: 'generating',
      message: 'Requesting questions from Skippy. Poll GET endpoint for updates.'
    });
  } catch (error) {
    console.error('Failed to generate batch questions:', error);
    return NextResponse.json({ 
      error: 'Failed to generate batch questions: ' + (error as Error).message 
    }, { status: 500 });
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
    const { answers } = body; // Array of { questionId, answer }

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Answers array required' }, { status: 400 });
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

    // Add user answers
    for (const answer of answers) {
      messages.push({
        role: 'user',
        questionId: answer.questionId,
        content: answer.answer,
        timestamp: Date.now()
      });
    }

    // Mark batch as complete
    messages.push({
      role: 'system',
      type: 'batch_complete',
      timestamp: Date.now()
    });

    // Update task
    getDb().prepare(`
      UPDATE tasks
      SET planning_messages = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(messages), taskId);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    // Trigger Skippy to process answers and optimize task
    if (isClawgUIConfigured()) {
      // Use clawg-ui (preferred)
      sendPlanningRequest(taskId, '', '', 'process_answers')
        .then(result => console.log('[Batch Planning] Skippy response:', result))
        .catch(err => console.error('[Batch Planning] clawg-ui error:', err));
    } else {
      // Fallback to webhook (legacy)
      try {
        await fetch('http://127.0.0.1:18789/hooks/wake', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mc-planning-webhook-secret',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `BATCH PLANNING COMPLETE for task "${taskId}"

The user has answered all planning questions. Please:

1. Read the answers from the task's planning_messages
2. Optimize the task description based on the answers
3. Determine the best manager (Dev/Marketing/Insights) to assign
4. Call the transition endpoint:

POST http://localhost:4000/api/tasks/${taskId}/planning/transition
Body: {
  "optimizedDescription": "Optimized task description with objective, context, requirements, constraints, success criteria",
  "assignedAgentId": "agent-id-here"
}

Agent IDs:
- Dev Manager: 8d3f0bf2-aaa4-4d0f-986f-38e32beb07ab
- Marketing Manager: da315bbd-0c06-4bba-9c6c-3280e50b35f8  
- Insights Manager: 4aef75a1-e6d2-43df-bb05-a64bcadae598`,
            mode: 'now',
          }),
        });
      } catch (webhookError) {
        console.error('[Batch Planning] Wake webhook error:', webhookError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Answers submitted. Task optimization in progress.',
      answersSubmitted: answers.length
    });
  } catch (error) {
    console.error('Failed to submit batch answers:', error);
    return NextResponse.json({ 
      error: 'Failed to submit batch answers: ' + (error as Error).message 
    }, { status: 500 });
  }
}

// GET /api/tasks/[id]/planning/questions/batch - Get current batch state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: string;
      planning_messages?: string;
      planning_stage?: string;
    } | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.planning_messages) {
      return NextResponse.json({
        questions: null,
        answers: [],
        isComplete: false
      });
    }

    const messages = JSON.parse(task.planning_messages);

    // Check if waiting for questions
    const isWaiting = messages.some((m: { role: string; type?: string }) => 
      m.role === 'system' && m.type === 'waiting_for_questions'
    );

    if (isWaiting) {
      return NextResponse.json({
        questions: null,
        answers: [],
        isComplete: false,
        status: 'generating',
        planningStage: task.planning_stage
      });
    }

    // Find batch questions
    const batchData = messages.find((m: { role: string; type?: string }) => 
      m.role === 'system' && m.type === 'batch_questions'
    );

    // Get answers
    const answers = messages
      .filter((m: { role: string }) => m.role === 'user')
      .map((m: { questionId?: string; content: string }) => ({
        questionId: m.questionId,
        answer: m.content
      }));

    // Check if complete
    const isComplete = messages.some((m: { role: string; type?: string }) => 
      m.role === 'system' && m.type === 'batch_complete'
    );

    return NextResponse.json({
      questions: batchData?.questions || null,
      answers,
      isComplete,
      planningStage: task.planning_stage
    });
  } catch (error) {
    console.error('Failed to get batch state:', error);
    return NextResponse.json({ 
      error: 'Failed to get batch state' 
    }, { status: 500 });
  }
}
