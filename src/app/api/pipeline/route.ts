import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { broadcast } from '@/lib/events';
import type { ContentItem } from '@/lib/types';

/**
 * GET /api/pipeline
 * List all content items
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');
    const platform = searchParams.get('platform');

    let sql = 'SELECT * FROM content_items WHERE 1=1';
    const params: string[] = [];

    if (stage) {
      sql += ' AND stage = ?';
      params.push(stage);
    }

    if (platform) {
      sql += ' AND platform = ?';
      params.push(platform);
    }

    sql += ' ORDER BY created_at DESC';

    const items = queryAll(sql, params);

    return NextResponse.json({ success: true, items, count: items.length });
  } catch (error) {
    console.error('Failed to fetch pipeline:', error);
    return NextResponse.json({ error: 'Failed to fetch pipeline' }, { status: 500 });
  }
}

/**
 * POST /api/pipeline
 * Create a new content item
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, type, platform, content, assigned_to } = body;

    if (!title || !type || !platform) {
      return NextResponse.json({ error: 'title, type, and platform required' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO content_items (id, title, type, platform, stage, content, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'idea', ?, ?, ?, ?)`,
      [id, title, type, platform, JSON.stringify(content || {}), assigned_to || null, now, now]
    );

    const item = queryOne<ContentItem>('SELECT * FROM content_items WHERE id = ?', [id]);

    if (item && item.id) {
      broadcast({ type: 'pipeline_updated', payload: item });
    }

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Failed to create content item:', error);
    return NextResponse.json({ error: 'Failed to create content item' }, { status: 500 });
  }
}
