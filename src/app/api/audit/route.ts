/**
 * Audit Log API
 * 
 * GET: List audit logs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, getAuditStats } from '@/lib/audit';

// GET /api/audit - List logs with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      action: searchParams.get('action') || undefined,
      actor: searchParams.get('actor') || undefined,
      targetType: searchParams.get('targetType') || undefined,
      targetId: searchParams.get('targetId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: parseInt(searchParams.get('limit') || '100'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    const logs = await getAuditLogs(filters);

    // Get stats if requested
    const includeStats = searchParams.get('stats') === 'true';
    const stats = includeStats ? await getAuditStats(7) : null;

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
      stats,
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    return NextResponse.json({ 
      error: 'Failed to get audit logs' 
    }, { status: 500 });
  }
}
