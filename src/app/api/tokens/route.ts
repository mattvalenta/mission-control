/**
 * Token Usage API
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { calculateCost, calculateTotalTokens, formatCost } from '@/lib/token-pricing';

// GET /api/tokens - List token usage with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const taskId = searchParams.get('task_id');
    const model = searchParams.get('model');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    let sql = 'SELECT * FROM token_usage WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (agentId) { sql += ` AND agent_id = $${paramIndex++}`; params.push(agentId); }
    if (taskId) { sql += ` AND task_id = $${paramIndex++}`; params.push(taskId); }
    if (model) { sql += ` AND model = $${paramIndex++}`; params.push(model); }
    if (startDate) { sql += ` AND created_at >= $${paramIndex++}`; params.push(startDate); }
    if (endDate) { sql += ` AND created_at <= $${paramIndex++}`; params.push(endDate); }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const usage = await queryAll(sql, params);
    const totalTokens = usage.reduce((sum: number, u: any) => sum + u.total_tokens, 0);
    const totalCost = usage.reduce((sum: number, u: any) => sum + u.cost, 0);

    return NextResponse.json({ success: true, usage, summary: { total_tokens: totalTokens, total_cost: totalCost, formatted_cost: formatCost(totalCost), record_count: usage.length } });
  } catch (error) {
    console.error('Failed to fetch token usage:', error);
    return NextResponse.json({ error: 'Failed to fetch token usage' }, { status: 500 });
  }
}

// POST /api/tokens - Record token usage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, agent_id, task_id, model, input_tokens, output_tokens } = body;

    if (!model || input_tokens === undefined || output_tokens === undefined) {
      return NextResponse.json({ error: 'model, input_tokens, and output_tokens are required' }, { status: 400 });
    }

    const totalTokens = calculateTotalTokens(input_tokens, output_tokens);
    const cost = calculateCost(model, input_tokens, output_tokens);
    const id = crypto.randomUUID();

    await run(`INSERT INTO token_usage (id, session_id, agent_id, task_id, model, input_tokens, output_tokens, total_tokens, cost, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [id, session_id || null, agent_id || null, task_id || null, model, input_tokens, output_tokens, totalTokens, cost]);

    const record = await queryOne('SELECT * FROM token_usage WHERE id = $1', [id]);

    return NextResponse.json({ success: true, record, summary: { total_tokens: totalTokens, cost, formatted_cost: formatCost(cost) } }, { status: 201 });
  } catch (error) {
    console.error('Failed to record token usage:', error);
    return NextResponse.json({ error: 'Failed to record token usage' }, { status: 500 });
  }
}
