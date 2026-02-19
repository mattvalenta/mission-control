import { NextRequest, NextResponse } from 'next/server';
import { getDb, run, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/agents/register
 * 
 * Agents call this to register themselves with Mission Control.
 * Returns agent ID and any pending tasks.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      role,
      webhook_url,
      machine_hostname,
      openclaw_host,
      poll_interval_ms,
      capabilities,
      avatar_emoji
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Agent name is required' }, { status: 400 });
    }

    // Check if agent already exists by name
    const existing = queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM agents WHERE name = ?',
      [name]
    );

    const now = new Date().toISOString();

    if (existing) {
      // Update existing agent
      run(`
        UPDATE agents SET
          role = ?,
          status = 'standby',
          updated_at = ?,
          webhook_url = ?,
          machine_hostname = ?,
          openclaw_host = ?,
          poll_interval_ms = ?,
          capabilities = ?,
          last_heartbeat = ?
        WHERE id = ?
      `, [
        role || name,
        now,
        webhook_url || null,
        machine_hostname || null,
        openclaw_host || null,
        poll_interval_ms || 30000,
        capabilities ? JSON.stringify(capabilities) : null,
        now,
        existing.id
      ]);

      return NextResponse.json({
        success: true,
        agent_id: existing.id,
        status: 'updated',
        message: `Agent ${name} re-registered`
      });
    }

    // Create new agent
    const agentId = uuidv4();
    
    run(`
      INSERT INTO agents (
        id, name, role, status, avatar_emoji, 
        webhook_url, machine_hostname, openclaw_host, 
        poll_interval_ms, capabilities, last_heartbeat,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'standby', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      agentId,
      name,
      role || name,
      avatar_emoji || '🤖',
      webhook_url || null,
      machine_hostname || null,
      openclaw_host || null,
      poll_interval_ms || 30000,
      capabilities ? JSON.stringify(capabilities) : null,
      now,
      now,
      now
    ]);

    return NextResponse.json({
      success: true,
      agent_id: agentId,
      status: 'created',
      message: `Agent ${name} registered successfully`
    });
  } catch (error) {
    console.error('Failed to register agent:', error);
    return NextResponse.json({ error: 'Failed to register agent: ' + (error as Error).message }, { status: 500 });
  }
}
