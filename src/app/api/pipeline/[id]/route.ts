import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import type { ContentItem } from '@/lib/types';

/**
 * PATCH /api/pipeline/[id] - Update content item
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { stage, content, research, schedule, analysis, assigned_to, denied_at, denied_by, denial_reason } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (stage) { updates.push(`stage = $${paramIndex++}`); values.push(stage); }
    if (content !== undefined) { updates.push(`content = $${paramIndex++}`); values.push(JSON.stringify(content)); }
    if (research !== undefined) { updates.push(`research = $${paramIndex++}`); values.push(JSON.stringify(research)); }
    if (schedule !== undefined) { updates.push(`schedule = $${paramIndex++}`); values.push(JSON.stringify(schedule)); }
    if (analysis !== undefined) { updates.push(`analysis = $${paramIndex++}`); values.push(JSON.stringify(analysis)); }
    if (assigned_to !== undefined) { updates.push(`assigned_to = $${paramIndex++}`); values.push(assigned_to); }
    if (denied_at !== undefined) { updates.push(`denied_at = $${paramIndex++}`); values.push(denied_at); }
    if (denied_by !== undefined) { updates.push(`denied_by = $${paramIndex++}`); values.push(denied_by); }
    if (denial_reason !== undefined) { updates.push(`denial_reason = $${paramIndex++}`); values.push(denial_reason); }

    if (updates.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    updates.push(`updated_at = NOW()`);
    values.push(id);

    await run(`UPDATE content_items SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);

    const item = await queryOne<ContentItem>('SELECT * FROM content_items WHERE id = $1', [id]);
    if (item) broadcast({ type: 'pipeline_updated', payload: item });

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Failed to update content item:', error);
    return NextResponse.json({ error: 'Failed to update content item' }, { status: 500 });
  }
}

/**
 * DELETE /api/pipeline/[id] - Delete a content item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await run('DELETE FROM content_items WHERE id = $1', [id]);
    broadcast({ type: 'pipeline_deleted', payload: { id } });
    return NextResponse.json({ success: true, message: 'Content item deleted' });
  } catch (error) {
    console.error('Failed to delete content item:', error);
    return NextResponse.json({ error: 'Failed to delete content item' }, { status: 500 });
  }
}
