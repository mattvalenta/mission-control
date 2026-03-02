import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, run, transaction } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { extractJSON, getMessagesFromOpenClaw } from '@/lib/planning-utils';
import { Task } from '@/lib/types';

// GET /api/tasks/[id]/planning/poll - Check for new messages from OpenClaw
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const task = await queryOne<any>('SELECT * FROM tasks WHERE id = $1', [taskId]);

    if (!task || !task.planning_session_key) {
      return NextResponse.json({ error: 'Planning session not found' }, { status: 404 });
    }

    if (task.planning_complete) {
      return NextResponse.json({ hasUpdates: false, isComplete: true });
    }

    if (task.planning_dispatch_error) {
      return NextResponse.json({ hasUpdates: true, dispatchError: task.planning_dispatch_error });
    }

    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];
    const initialAssistantCount = messages.filter((m: any) => m.role === 'assistant').length;

    const openclawMessages = await getMessagesFromOpenClaw(task.planning_session_key);

    if (openclawMessages.length > initialAssistantCount) {
      let currentQuestion = null;
      const newMessages = openclawMessages.slice(initialAssistantCount);

      for (const msg of newMessages) {
        if (msg.role === 'assistant') {
          const lastMessage = { role: 'assistant', content: msg.content, timestamp: Date.now() };
          messages.push(lastMessage);

          const parsed = extractJSON(msg.content);

          if (parsed && parsed.status === 'complete') {
            // Handle completion
            await run(`UPDATE tasks SET planning_messages = $1, planning_spec = $2, planning_agents = $3, status = 'pending_dispatch' WHERE id = $4`,
              [JSON.stringify(messages), JSON.stringify(parsed.spec), JSON.stringify(parsed.agents), taskId]);

            // Create agents
            let firstAgentId: string | null = null;
            if (parsed.agents && parsed.agents.length > 0) {
              for (const agent of parsed.agents) {
                const agentId = crypto.randomUUID();
                if (!firstAgentId) firstAgentId = agentId;
                await run(`INSERT INTO agents (id, workspace_id, name, role, description, avatar_emoji, status, soul_md, created_at, updated_at)
                  SELECT $1, workspace_id, $2, $3, $4, $5, 'standby', $6, NOW(), NOW() FROM tasks WHERE id = $7`,
                  [agentId, agent.name, agent.role, agent.instructions || '', agent.avatar_emoji || '🤖', agent.soul_md || '', taskId]);
              }
            }

            // Dispatch
            if (firstAgentId) {
              try {
                const dispatchRes = await fetch(`http://localhost:${process.env.PORT || 3000}/api/tasks/${taskId}/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
                if (dispatchRes.ok) {
                  await run(`UPDATE tasks SET planning_complete = true, assigned_agent_id = $1, status = 'inbox', updated_at = NOW() WHERE id = $2`, [firstAgentId, taskId]);
                } else {
                  await run(`UPDATE tasks SET planning_dispatch_error = $1, updated_at = NOW() WHERE id = $2`, [`Dispatch failed: ${dispatchRes.status}`, taskId]);
                }
              } catch (err: any) {
                await run(`UPDATE tasks SET planning_dispatch_error = $1, updated_at = NOW() WHERE id = $2`, [`Dispatch error: ${err.message}`, taskId]);
              }
            } else {
              await run(`UPDATE tasks SET planning_complete = true, status = 'inbox', updated_at = NOW() WHERE id = $1`, [taskId]);
            }

            const updatedTask = await queryOne<Task>('SELECT * FROM tasks WHERE id = $1', [taskId]);
            if (updatedTask) broadcast({ type: 'task_updated', payload: updatedTask });

            return NextResponse.json({ hasUpdates: true, complete: true, spec: parsed.spec, agents: parsed.agents, messages, autoDispatched: !!firstAgentId });
          }

          if (parsed && parsed.question && parsed.options) {
            currentQuestion = parsed;
          }
        }
      }

      await run('UPDATE tasks SET planning_messages = $1 WHERE id = $2', [JSON.stringify(messages), taskId]);

      return NextResponse.json({ hasUpdates: true, complete: false, messages, currentQuestion });
    }

    return NextResponse.json({ hasUpdates: false });
  } catch (error) {
    console.error('Failed to poll for updates:', error);
    return NextResponse.json({ error: 'Failed to poll for updates' }, { status: 500 });
  }
}
