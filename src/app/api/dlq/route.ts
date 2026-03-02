/**
 * Dead Letter Queue API
 * 
 * GET: List DLQ entries
 * POST: Resolve or retry DLQ entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDLQEntries, resolveDLQEntry, retryDLQEntry } from '@/lib/scheduler';

// GET /api/dlq - List DLQ entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const unresolvedOnly = searchParams.get('unresolved') !== 'false';

    const entries = await getDLQEntries(unresolvedOnly);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error) {
    console.error('Failed to get DLQ entries:', error);
    return NextResponse.json({ 
      error: 'Failed to get DLQ entries' 
    }, { status: 500 });
  }
}

// POST /api/dlq - Resolve or retry entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, resolvedBy } = body;

    if (!id) {
      return NextResponse.json({ 
        error: 'Missing id parameter' 
      }, { status: 400 });
    }

    if (action === 'resolve') {
      await resolveDLQEntry(id, resolvedBy || 'manual');
      return NextResponse.json({
        success: true,
        message: 'DLQ entry resolved',
      });
    } else if (action === 'retry') {
      await retryDLQEntry(id);
      return NextResponse.json({
        success: true,
        message: 'DLQ entry marked for retry',
      });
    } else {
      return NextResponse.json({ 
        error: 'Invalid action. Use "resolve" or "retry"' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to process DLQ entry:', error);
    return NextResponse.json({ 
      error: 'Failed to process DLQ entry',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
