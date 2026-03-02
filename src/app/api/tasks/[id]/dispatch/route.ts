import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { getProjectsPath, getMissionControlUrl } from '@/lib/config';
import type { Task, Agent, OpenClawSession } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/dispatch - Dispatches a task to its assigned agent
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const task = await queryOne<Task & { assigned_agent_name?: string; workspace_id: string }>(
      `SELECT t.*, a.name as assigned_agent_name, a.is_master FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id WHERE t.id = $1`,
      [id]
    );

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (!task.assigned_agent_id) return NextResponse.json({ error: 'Task has no assigned agent' }, { status: 400 });

    const agent = await queryOne<Agent>('SELECT * FROM agents WHERE id = $1', [task.assigned_agent_id]);
    if (!agent) return NextResponse.json({ error: 'Assigned agent not found' }, { status: 404 });

    // Check for other orchestrators if dispatching to master
    if (agent.is_master) {
      const otherOrchestrators = await queryAll<any>(
        `SELECT id, name, role FROM agents WHERE is_master = true AND id != $1 AND workspace_id = $2 AND status != 'offline'`,
        [agent.id, task.workspace_id]
      );

      if (otherOrchestrators.length > 0) {
        return NextResponse.json({
          success: false, warning: 'Other orchestrators available',
          message: `There ${otherOrchestrators.length === 1 ? 'is' : 'are'} ${otherOrchestrators.length} other orchestrator(s) available.`,
          otherOrchestrators,
        }, { status: 409 });
      }
    }

    // Connect to OpenClaw Gateway
    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try { await client.connect(); }
      catch (err) { return NextResponse.json({ error: 'Failed to connect to OpenClaw Gateway' }, { status: 503 }); }
    }

    // Get or create session
    let session = await queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = $1 AND status = $2',
      [agent.id, 'active']
    );

    if (!session) {
      const sessionId = uuidv4();
      const openclawSessionId = `mission-control-${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
      
      await run(
        `INSERT INTO openclaw_sessions (id, agent_id, openclaw_session_id, channel, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [sessionId, agent.id, openclawSessionId, 'mission-control', 'active']
      );

      session = await queryOne<OpenClawSession>('SELECT * FROM openclaw_sessions WHERE id = $1', [sessionId]);

      await run(
        `INSERT INTO events (id, type, agent_id, message, created_at) VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), 'agent_status_changed', agent.id, `${agent.name} session created`]
      );
    }

    if (!session) return NextResponse.json({ error: 'Failed to create agent session' }, { status: 500 });

    // Build task message
    const priorityEmoji = { low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴' }[task.priority] || '⚪';
    const projectsPath = getProjectsPath();
    const projectDir = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const taskProjectDir = `${projectsPath}/${projectDir}`;
    const missionControlUrl = getMissionControlUrl();

    const taskMessage = `${priorityEmoji} **NEW TASK ASSIGNED**

**Title:** ${task.title}
${task.description ? `**Description:** ${task.description}\n` : ''}
**Priority:** ${task.priority.toUpperCase()}
${task.due_date ? `**Due:** ${task.due_date}\n` : ''}
**Task ID:** ${task.id}

**OUTPUT DIRECTORY:** ${taskProjectDir}

**IMPORTANT:** After completing work, call these APIs:
1. Log activity: POST ${missionControlUrl}/api/tasks/${task.id}/activities
2. Register deliverable: POST ${missionControlUrl}/api/tasks/${task.id}/deliverables
3. Update status: PATCH ${missionControlUrl}/api/tasks/${task.id} with {"status": "review"}

When complete, reply with: \`TASK_COMPLETE: [summary]\``;

    // Send message to agent's session
    try {
      const sessionKey = `agent:main:${session.openclaw_session_id}`;
      await client.call('chat.send', {
        sessionKey, message: taskMessage, idempotencyKey: `dispatch-${task.id}-${Date.now()}`
      });
    } catch (sendError: any) {
      console.error('Failed to send task to agent:', sendError);
      return NextResponse.json({ error: 'Failed to send task to agent', details: sendError.message }, { status: 500 });
    }

    // Update task status
    await run(
      `UPDATE tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Log dispatch event
    await run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [uuidv4(), 'task_dispatched', agent.id, id, `"${task.title}" dispatched to ${agent.name}`]
    );

    // Broadcast update
    const updatedTask = await queryOne<Task>(
      `SELECT t.*, a.name as assigned_agent_name FROM tasks t LEFT JOIN agents a ON t.assigned_agent_id = a.id WHERE t.id = $1`,
      [id]
    );
    if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

    return NextResponse.json({
      success: true,
      message: `Task dispatched to ${agent.name}`,
      sessionKey: `agent:main:${session.openclaw_session_id}`,
    });
  } catch (error) {
    console.error('Failed to dispatch task:', error);
    return NextResponse.json({ error: 'Failed to dispatch task' }, { status: 500 });
  }
}
