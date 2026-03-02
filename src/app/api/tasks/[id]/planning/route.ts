import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { extractJSON } from '@/lib/planning-utils';

const PLANNING_SESSION_PREFIX = 'agent:main:planning:';
const SKIPPY_AGENT_ID = '3a90091a-a6e5-4abc-934e-117210d07d73';

// GET /api/tasks/[id]/planning - Get planning state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    const lastAssistantMessage = [...messages].reverse().find((m: any) => m.role === 'assistant');
    let currentQuestion = null;

    if (lastAssistantMessage) {
      const parsed = extractJSON(lastAssistantMessage.content);
      if (parsed && 'question' in parsed) currentQuestion = parsed;
    }

    const planningStage = task.planning_stage || 'user_planning';
    const isUserPlanning = planningStage === 'user_planning' && task.assigned_agent_id === SKIPPY_AGENT_ID;
    const isAgentPlanning = planningStage === 'agent_planning';

    return NextResponse.json({
      taskId, sessionKey: task.planning_session_key, messages, currentQuestion,
      isComplete: !!task.planning_complete, spec: task.planning_spec ? JSON.parse(task.planning_spec) : null,
      agents: task.planning_agents ? JSON.parse(task.planning_agents) : null, isStarted: messages.length > 0,
      planningStage, isUserPlanning, isAgentPlanning, optimizedDescription: task.optimized_description,
    });
  } catch (error) {
    console.error('Failed to get planning state:', error);
    return NextResponse.json({ error: 'Failed to get planning state' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/planning - Start planning session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.planning_session_key) {
      return NextResponse.json({ error: 'Planning already started', sessionKey: task.planning_session_key }, { status: 400 });
    }

    const isUserPlanning = task.assigned_agent_id === SKIPPY_AGENT_ID || !task.assigned_agent_id;
    const planningStage = isUserPlanning ? 'user_planning' : 'agent_planning';
    const sessionKey = `${PLANNING_SESSION_PREFIX}${taskId}`;
    const planningPrompt = isUserPlanning ? buildUserPlanningPrompt(task) : buildAgentPlanningPrompt(task);
    const messages = [{ role: 'user', content: planningPrompt, timestamp: Date.now() }];

    await run(`
      UPDATE tasks SET planning_session_key = $1, planning_messages = $2, planning_stage = $3, status = 'planning' WHERE id = $4
    `, [sessionKey, JSON.stringify(messages), planningStage, taskId]);

    // Trigger Skippy via wake webhook
    try {
      await fetch('http://127.0.0.1:18789/hooks/wake', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer mc-planning-webhook-secret', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `PLANNING REQUEST for task "${task.title}" (ID: ${taskId})\n\nPlease generate a clarifying question.\n\nTask Description: ${task.description || 'No description'}\n\nRespond in JSON format with question and options.`,
          mode: 'now',
        }),
      });
    } catch (webhookError) {
      console.error('[Planning] Wake webhook error:', webhookError);
    }

    return NextResponse.json({ success: true, sessionKey, messages, planningStage, note: 'Planning started.' });
  } catch (error) {
    console.error('Failed to start planning:', error);
    return NextResponse.json({ error: 'Failed to start planning: ' + (error as Error).message }, { status: 500 });
  }
}

// PATCH /api/tasks/[id]/planning - Transition planning stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { action, optimizedDescription, assignedAgentId } = body;

    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (action === 'transition_to_agent') {
      if (!optimizedDescription || !assignedAgentId) {
        return NextResponse.json({ error: 'Optimized description and assigned agent required' }, { status: 400 });
      }

      await run(`
        UPDATE tasks SET planning_stage = 'agent_planning', optimized_description = $1, assigned_agent_id = $2,
        planning_session_key = NULL, planning_messages = NULL, updated_at = NOW() WHERE id = $3
      `, [optimizedDescription, assignedAgentId, taskId]);

      const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

      return NextResponse.json({ success: true, message: 'Task optimized and assigned.', planningStage: 'agent_planning' });
    }

    if (action === 'complete_planning') {
      await run(`
        UPDATE tasks SET planning_stage = 'complete', planning_complete = true, status = 'assigned', updated_at = NOW() WHERE id = $1
      `, [taskId]);

      const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

      return NextResponse.json({ success: true, message: 'Planning complete.', planningStage: 'complete' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update planning:', error);
    return NextResponse.json({ error: 'Failed to update planning' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id]/planning - Cancel planning session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    await run(`
      UPDATE tasks SET planning_session_key = NULL, planning_messages = NULL, planning_complete = false,
      planning_spec = NULL, planning_agents = NULL, planning_stage = 'user_planning', status = 'inbox', updated_at = NOW() WHERE id = $1
    `, [taskId]);

    const updatedTask = await queryOne('SELECT * FROM tasks WHERE id = $1', [taskId]);
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel planning:', error);
    return NextResponse.json({ error: 'Failed to cancel planning' }, { status: 500 });
  }
}

function buildUserPlanningPrompt(task: any) {
  return `USER PLANNING SESSION - STAGE 1\n\nYou are Skippy, helping clarify a task.\n\nTask Title: ${task.title}\nTask Description: ${task.description || 'No description provided'}\n\nAsk clarifying questions to understand the scope, priority, and success criteria.`;
}

function buildAgentPlanningPrompt(task: any) {
  const description = task.optimized_description || task.description;
  return `AGENT PLANNING SESSION - STAGE 2\n\nTask Title: ${task.title}\nOptimized Description:\n${description || 'No description provided'}\n\nFocus on implementation details and dependencies.`;
}
