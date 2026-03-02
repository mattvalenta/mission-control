/**
 * Security Events API
 * 
 * GET: List security-specific audit events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSecurityEvents } from '@/lib/audit';

// GET /api/audit/security - List security events
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const events = await getSecurityEvents(limit);

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('Failed to get security events:', error);
    return NextResponse.json({ 
      error: 'Failed to get security events' 
    }, { status: 500 });
  }
}
