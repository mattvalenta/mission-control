/**
 * Token Usage Summary API
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { formatCost } from '@/lib/token-pricing';

// GET /api/tokens/summary - Aggregated token usage statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build date filter
    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) { dateFilter += ` AND created_at >= $${paramIndex++}`; params.push(startDate); }
    if (endDate) { dateFilter += ` AND created_at <= $${paramIndex++}`; params.push(endDate); }

    // Total summary
    const totals = await queryAll<{ total_tokens: string; total_cost: string; total_input_tokens: string; total_output_tokens: string; record_count: string }>(
      `SELECT COALESCE(SUM(total_tokens), 0) as total_tokens, COALESCE(SUM(cost), 0) as total_cost, COALESCE(SUM(input_tokens), 0) as total_input_tokens, COALESCE(SUM(output_tokens), 0) as total_output_tokens, COUNT(*) as record_count FROM token_usage WHERE 1=1${dateFilter}`,
      params
    );

    // By agent
    const byAgent = await queryAll<{ agent_id: string; total_tokens: string; total_cost: string; record_count: string }>(
      `SELECT agent_id, SUM(total_tokens) as total_tokens, SUM(cost) as total_cost, COUNT(*) as record_count FROM token_usage WHERE agent_id IS NOT NULL${dateFilter} GROUP BY agent_id ORDER BY total_cost DESC LIMIT 10`,
      params
    );

    // By model
    const byModel = await queryAll<{ model: string; total_tokens: string; total_cost: string; record_count: string }>(
      `SELECT model, SUM(total_tokens) as total_tokens, SUM(cost) as total_cost, COUNT(*) as record_count FROM token_usage WHERE 1=1${dateFilter} GROUP BY model ORDER BY total_cost DESC LIMIT 10`,
      params
    );

    // By day (last 30 days)
    const byDay = await queryAll<{ date: string; total_tokens: string; total_cost: string; record_count: string }>(
      `SELECT DATE(created_at) as date, SUM(total_tokens) as total_tokens, SUM(cost) as total_cost, COUNT(*) as record_count FROM token_usage WHERE created_at >= NOW() - INTERVAL '30 days'${dateFilter.replace('WHERE 1=1', 'AND')} GROUP BY DATE(created_at) ORDER BY date DESC`,
      params
    );

    const summary = totals[0] || { total_tokens: '0', total_cost: '0', total_input_tokens: '0', total_output_tokens: '0', record_count: '0' };

    return NextResponse.json({
      success: true,
      summary: {
        total_tokens: parseInt(summary.total_tokens),
        total_input_tokens: parseInt(summary.total_input_tokens),
        total_output_tokens: parseInt(summary.total_output_tokens),
        total_cost: parseFloat(summary.total_cost),
        formatted_cost: formatCost(parseFloat(summary.total_cost)),
        record_count: parseInt(summary.record_count),
      },
      by_agent: byAgent.map(a => ({
        agent_id: a.agent_id,
        total_tokens: parseInt(a.total_tokens),
        total_cost: parseFloat(a.total_cost),
        formatted_cost: formatCost(parseFloat(a.total_cost)),
        record_count: parseInt(a.record_count),
      })),
      by_model: byModel.map(m => ({
        model: m.model,
        total_tokens: parseInt(m.total_tokens),
        total_cost: parseFloat(m.total_cost),
        formatted_cost: formatCost(parseFloat(m.total_cost)),
        record_count: parseInt(m.record_count),
      })),
      by_day: byDay.map(d => ({
        date: d.date,
        total_tokens: parseInt(d.total_tokens),
        total_cost: parseFloat(d.total_cost),
        formatted_cost: formatCost(parseFloat(d.total_cost)),
        record_count: parseInt(d.record_count),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch token summary:', error);
    return NextResponse.json({ error: 'Failed to fetch token summary' }, { status: 500 });
  }
}
