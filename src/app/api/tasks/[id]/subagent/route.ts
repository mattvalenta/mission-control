/**
 * Subagent Registration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, queryAll, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/subagent - Register a sub-agent session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();
    const { openclaw_session_id, agent_name } = body;

    if (!openclaw_session_id) return NextResponse.json({ error: 'openclaw_session_id is required' }, { status: 400 });

    const sessionId = crypto.randomUUID();
    let agentId: string | null = null;
    
    if (agent_name) {
      const existingAgent = await queryOne<{ id: string }>('SELECT id FROM agents WHERE name = $1', [agent_name]);
      
      if (existingAgent) {
        agentId = existingAgent.id;
      } else {
        agentId = crypto.randomUUID();
        await run(`INSERT INTO agents (id, name, role, description, status, created_at, updated_at) VALUES ($1, $2, 'Sub-Agent', 'Automatically created sub-agent', 'working', NOW(), NOW())`,
          [agentId, agent_name]);
      }
    }

    await run(`INSERT INTO openclaw_sessions (id, agent_id, openclaw_session_id, session_type, task_id, status, created_at, updated_at) VALUES ($1, $2, $3, 'subagent', $4, 'active', NOW(), NOW())`,
      [sessionId, agentId, openclaw_session_id, taskId]);

    const session = await queryOne('SELECT * FROM openclaw_sessions WHERE id = $1', [sessionId]);

    broadcast({ type: 'agent_spawned', payload: { taskId, sessionId: openclaw_session_id, agentName: agent_name } });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('Error registering sub-agent:', error);
    return NextResponse.json({ error: 'Failed to register sub-agent' }, { status: 500 });
  }
}

/**
 * GET /api/tasks/[id]/subagent - Get all sub-agent sessions for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const sessions = await queryAll(`
      SELECT s.*, a.name as agent_name, a.avatar_emoji as agent_avatar_emoji
      FROM openclaw_sessions s LEFT JOIN agents a ON s.agent_id = a.id
      WHERE s.task_id = $1 AND s.session_type = 'subagent' ORDER BY s.created_at DESC
    `, [taskId]);

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sub-agents:', error);
    return NextResponse.json({ error: 'Failed to fetch sub-agents' }, { status: 500 });
  }
}
