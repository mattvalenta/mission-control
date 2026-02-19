import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';

/**
 * PATCH /api/team/[id]
 * Update team member status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 });
    }

    run('UPDATE team_members SET status = ?, updated_at = ? WHERE id = ?', [
      status,
      new Date().toISOString(),
      id,
    ]);

    const member = queryOne('SELECT * FROM team_members WHERE id = ?', [id]);

    return NextResponse.json({ success: true, member });
  } catch (error) {
    console.error('Failed to update team member:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}
