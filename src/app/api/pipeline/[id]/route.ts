import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import type { ContentItem } from '@/lib/types';

/**
 * PATCH /api/pipeline/[id]
 * Update content item (primarily for stage changes)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { stage, content, research, schedule, analysis, assigned_to } = body;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (stage) {
      updates.push('stage = ?');
      values.push(stage);
    }
    if (content !== undefined) {
      updates.push('content = ?');
      values.push(JSON.stringify(content));
    }
    if (research !== undefined) {
      updates.push('research = ?');
      values.push(JSON.stringify(research));
    }
    if (schedule !== undefined) {
      updates.push('schedule = ?');
      values.push(JSON.stringify(schedule));
    }
    if (analysis !== undefined) {
      updates.push('analysis = ?');
      values.push(JSON.stringify(analysis));
    }
    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      values.push(assigned_to);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    run(`UPDATE content_items SET ${updates.join(', ')} WHERE id = ?`, values);

    const item = queryOne<ContentItem>('SELECT * FROM content_items WHERE id = ?', [id]);

    if (item && item.id) {
      broadcast({ type: 'pipeline_updated', payload: item });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Failed to update content item:', error);
    return NextResponse.json({ error: 'Failed to update content item' }, { status: 500 });
  }
}

/**
 * DELETE /api/pipeline/[id]
 * Delete a content item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    run('DELETE FROM content_items WHERE id = ?', [id]);

    broadcast({ type: 'pipeline_deleted', payload: { id } });

    return NextResponse.json({ success: true, message: 'Content item deleted' });
  } catch (error) {
    console.error('Failed to delete content item:', error);
    return NextResponse.json({ error: 'Failed to delete content item' }, { status: 500 });
  }
}
