import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { notifyBoth } from '@/lib/db/notify-wrapper';
import type { Agent, CreateAgentRequest } from '@/lib/types';

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    
    let agents: Agent[];
    if (workspaceId) {
      agents = await queryAll<Agent>(`SELECT * FROM agents WHERE workspace_id = $1 ORDER BY is_master DESC, name ASC`, [workspaceId]);
    } else {
      agents = await queryAll<Agent>(`SELECT * FROM agents ORDER BY is_master DESC, name ASC`);
    }
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body: CreateAgentRequest = await request.json();

    if (!body.name || !body.role) return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });

    const id = uuidv4();

    await run(
      `INSERT INTO agents (id, name, role, description, avatar_emoji, is_master, workspace_id, soul_md, user_md, agents_md, model, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
      [
        id, body.name, body.role, body.description || null, body.avatar_emoji || '🤖',
        body.is_master || false, (body as any).workspace_id || 'default',
        body.soul_md || null, body.user_md || null, body.agents_md || null, body.model || null
      ]
    );

    await run(`INSERT INTO events (id, type, agent_id, message, created_at) VALUES ($1, $2, $3, $4, NOW())`,
      [uuidv4(), 'agent_joined', id, `${body.name} joined the team`]);

    const agent = await queryOne<Agent>('SELECT * FROM agents WHERE id = $1', [id]);

    // Broadcast agent creation via SSE + PostgreSQL NOTIFY
    if (agent) {
      await notifyBoth('agent_updates', 'agent_created', { agentId: id, agent });
    }

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
