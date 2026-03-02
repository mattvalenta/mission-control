/**
 * Quality Reviews List API
 * Get all reviews for a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

// GET /api/tasks/[id]/reviews - List all reviews for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const reviews = await queryAll(`
      SELECT 
        qr.*,
        a.name as reviewer_name,
        a.avatar_emoji as reviewer_emoji
      FROM quality_reviews qr
      LEFT JOIN agents a ON qr.reviewer_id = a.id
      WHERE qr.task_id = $1
      ORDER BY qr.created_at DESC
    `, [taskId]);

    return NextResponse.json({
      success: true,
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch reviews' 
    }, { status: 500 });
  }
}
