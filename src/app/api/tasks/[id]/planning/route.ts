import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { extractJSON } from '@/lib/planning-utils';

// Planning session prefix for OpenClaw
const PLANNING_SESSION_PREFIX = 'agent:main:planning:';

// Skippy's agent ID
const SKIPPY_AGENT_ID = '3a90091a-a6e5-4abc-934e-117210d07d73';

// GET /api/tasks/[id]/planning - Get planning state
export async function GET(
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
      planning_complete?: number;
      planning_spec?: string;
      planning_agents?: string;
      planning_stage?: string;
      optimized_description?: string;
    } | undefined;
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];

    // Find the latest question
    const lastAssistantMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'assistant');
    let currentQuestion = null;

    if (lastAssistantMessage) {
      const parsed = extractJSON(lastAssistantMessage.content);
      if (parsed && 'question' in parsed) {
        currentQuestion = parsed;
      }
    }

    // Determine planning stage
    const planningStage = task.planning_stage || 'user_planning';
    const isUserPlanning = planningStage === 'user_planning' && task.assigned_agent_id === SKIPPY_AGENT_ID;
    const isAgentPlanning = planningStage === 'agent_planning';

    return NextResponse.json({
      taskId,
      sessionKey: task.planning_session_key,
      messages,
      currentQuestion,
      isComplete: !!task.planning_complete,
      spec: task.planning_spec ? JSON.parse(task.planning_spec) : null,
      agents: task.planning_agents ? JSON.parse(task.planning_agents) : null,
      isStarted: messages.length > 0,
      planningStage,
      isUserPlanning,
      isAgentPlanning,
      optimizedDescription: task.optimized_description,
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
    const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: string;
      title: string;
      description: string;
      status: string;
      workspace_id: string;
      assigned_agent_id?: string;
      planning_session_key?: string;
      planning_messages?: string;
      planning_stage?: string;
    } | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if planning already started
    if (task.planning_session_key) {
      return NextResponse.json({ error: 'Planning already started', sessionKey: task.planning_session_key }, { status: 400 });
    }

    // Determine planning stage based on assignee
    const isUserPlanning = task.assigned_agent_id === SKIPPY_AGENT_ID || !task.assigned_agent_id;
    const planningStage = isUserPlanning ? 'user_planning' : 'agent_planning';

    // Create session key
    const sessionKey = `${PLANNING_SESSION_PREFIX}${taskId}`;

    // Build the planning prompt based on stage
    const planningPrompt = isUserPlanning
      ? buildUserPlanningPrompt(task)
      : buildAgentPlanningPrompt(task);

    // Store the session key and initial message
    const messages = [{ role: 'user', content: planningPrompt, timestamp: Date.now() }];

    getDb().prepare(`
      UPDATE tasks
      SET planning_session_key = ?, 
          planning_messages = ?, 
          planning_stage = ?,
          status = 'planning'
      WHERE id = ?
    `).run(sessionKey, JSON.stringify(messages), planningStage, taskId);

    // Trigger Skippy via wake webhook - this sends a system event to the main session
    // The agent will respond when it processes the event
    try {
      const webhookResponse = await fetch('http://127.0.0.1:18789/hooks/wake', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mc-planning-webhook-secret',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `PLANNING REQUEST for task "${task.title}" (ID: ${taskId})

Please generate a clarifying question for this task. The question should be multiple choice with 4 options.

Task Description: ${task.description || 'No description'}

Respond in JSON format:
{
  "question": "Your question here?",
  "options": [
    {"id": "A", "label": "Option 1"},
    {"id": "B", "label": "Option 2"},
    {"id": "C", "label": "Option 3"},
    {"id": "other", "label": "Other (please specify)"}
  ]
}

After generating, store your response by calling:
POST http://localhost:4000/api/tasks/${taskId}/planning/answer
with body: {"question": {...}, "options": [...]}`,
          mode: 'now',
        }),
      });

      if (webhookResponse.ok) {
        console.log('[Planning] Wake webhook triggered successfully');
      } else {
        console.error('[Planning] Wake webhook failed:', await webhookResponse.text());
      }
    } catch (webhookError) {
      console.error('[Planning] Wake webhook error:', webhookError);
    }

    return NextResponse.json({
      success: true,
      sessionKey,
      messages,
      planningStage,
      note: 'Planning started. Skippy will generate questions shortly.',
    });
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

    const task = queryOne<{
      id: string;
      planning_stage?: string;
      planning_session_key?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (action === 'transition_to_agent') {
      // Stage 1 → Stage 2: User planning complete, assign to manager
      if (!optimizedDescription) {
        return NextResponse.json({ error: 'Optimized description required' }, { status: 400 });
      }
      if (!assignedAgentId) {
        return NextResponse.json({ error: 'Assigned agent required' }, { status: 400 });
      }

      // Update task with optimized description and new assignee
      run(`
        UPDATE tasks
        SET planning_stage = 'agent_planning',
            optimized_description = ?,
            assigned_agent_id = ?,
            planning_session_key = NULL,
            planning_messages = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `, [optimizedDescription, assignedAgentId, taskId]);

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
        message: 'Task optimized and assigned. Stage 2 planning ready.',
        planningStage: 'agent_planning',
      });
    }

    if (action === 'complete_planning') {
      // Stage 2 complete: Ready for execution
      run(`
        UPDATE tasks
        SET planning_stage = 'complete',
            planning_complete = 1,
            status = 'assigned',
            updated_at = datetime('now')
        WHERE id = ?
      `, [taskId]);

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
        message: 'Planning complete. Ready for execution.',
        planningStage: 'complete',
      });
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
    run(`
      UPDATE tasks
      SET planning_session_key = NULL,
          planning_messages = NULL,
          planning_complete = 0,
          planning_spec = NULL,
          planning_agents = NULL,
          planning_stage = 'user_planning',
          status = 'inbox',
          updated_at = datetime('now')
      WHERE id = ?
    `, [taskId]);

    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to cancel planning:', error);
    return NextResponse.json({ error: 'Failed to cancel planning' }, { status: 500 });
  }
}

// Helper: Build user planning prompt (Stage 1)
function buildUserPlanningPrompt(task: { title: string; description: string }) {
  return `USER PLANNING SESSION - STAGE 1

You are Skippy, helping clarify a task before assigning it to the appropriate manager.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

Your goal is to ask clarifying questions to understand:
1. What the user really wants to accomplish
2. The scope and priority of the task
3. Any constraints or requirements
4. Success criteria

Generate your FIRST question. Remember:
- Questions must be multiple choice
- Include an "Other" option for flexibility
- Be specific to THIS task, not generic
- Ask ONE question at a time

After 3-5 questions, you will:
1. Optimize the task description with all context gathered
2. Recommend which manager should handle this (Dev, Marketing, or Insights)

Respond with ONLY valid JSON:
{
  "question": "Your question here?",
  "options": [
    {"id": "A", "label": "First option"},
    {"id": "B", "label": "Second option"},
    {"id": "C", "label": "Third option"},
    {"id": "other", "label": "Other"}
  ]
}`;
}

// Helper: Build agent planning prompt (Stage 2)
function buildAgentPlanningPrompt(task: { title: string; description: string; optimized_description?: string }) {
  const description = task.optimized_description || task.description;
  
  return `AGENT PLANNING SESSION - STAGE 2

You are a manager reviewing an optimized task specification.

Task Title: ${task.title}
Optimized Description:
${description || 'No description provided'}

Your goal is to:
1. Ask any technical/specialized questions needed
2. Identify dependencies and risks
3. Confirm you have everything needed to execute

Generate your FIRST question. Remember:
- Focus on implementation details
- Questions must be multiple choice
- Include an "Other" option
- Be specific to YOUR specialty area

Respond with ONLY valid JSON:
{
  "question": "Your question here?",
  "options": [
    {"id": "A", "label": "First option"},
    {"id": "B", "label": "Second option"},
    {"id": "C", "label": "Third option"},
    {"id": "other", "label": "Other"}
  ]
}`;
}
