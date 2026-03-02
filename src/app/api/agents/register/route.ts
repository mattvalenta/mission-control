import { NextRequest, NextResponse } from 'next/server';
import { run, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agents/register - Register agent with Mission Control
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, role, webhook_url, machine_hostname, openclaw_host, poll_interval_ms, capabilities, avatar_emoji } = body;

    if (!name) return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });

    const existing = await queryOne<{ id: string; status: string }>('SELECT id, status FROM agents WHERE name = $1', [name]);

    if (existing) {
      await run(`UPDATE agents SET role = $1, status = 'standby', updated_at = NOW(), webhook_url = $2, machine_hostname = $3, openclaw_host = $4, poll_interval_ms = $5, capabilities = $6, last_heartbeat = NOW() WHERE id = $7`,
        [role || name, webhook_url || null, machine_hostname || null, openclaw_host || null, poll_interval_ms || 30000, capabilities ? JSON.stringify(capabilities) : null, existing.id]);

      return NextResponse.json({ success: true, agent_id: existing.id, status: 'updated', message: `Agent ${name} re-registered` });
    }

    const agentId = uuidv4();
    await run(`INSERT INTO agents (id, name, role, status, avatar_emoji, webhook_url, machine_hostname, openclaw_host, poll_interval_ms, capabilities, last_heartbeat, created_at, updated_at) VALUES ($1, $2, $3, 'standby', $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
      [agentId, name, role || name, avatar_emoji || '🤖', webhook_url || null, machine_hostname || null, openclaw_host || null, poll_interval_ms || 30000, capabilities ? JSON.stringify(capabilities) : null]);

    return NextResponse.json({ success: true, agent_id: agentId, status: 'created', message: `Agent ${name} registered successfully` });
  } catch (error) {
    console.error('Failed to register agent:', error);
    return NextResponse.json({ error: 'Failed to register agent: ' + (error as Error).message }, { status: 500 });
  }
}
