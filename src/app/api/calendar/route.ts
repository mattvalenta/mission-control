import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/calendar
 * List calendar events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const tier = searchParams.get('tier');

    let sql = 'SELECT * FROM calendar_events WHERE 1=1';
    const params: string[] = [];

    if (start) {
      sql += ' AND date(start_time) >= date(?)';
      params.push(start);
    }

    if (end) {
      sql += ' AND date(start_time) <= date(?)';
      params.push(end);
    }

    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }

    sql += ' ORDER BY start_time ASC';

    const events = queryAll(sql, params);

    return NextResponse.json({ success: true, events, count: events.length });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}

/**
 * POST /api/calendar
 * Create a new calendar event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, start_time, end_time, type, tier, agent_id, agent_name, color, recurring } = body;

    if (!title || !start_time) {
      return NextResponse.json({ error: 'title and start_time required' }, { status: 400 });
    }

    const id = uuidv4();

    run(
      `INSERT INTO calendar_events 
       (id, title, description, start_time, end_time, type, tier, agent_id, agent_name, color, recurring)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        title,
        description || null,
        start_time,
        end_time || null,
        type || 'meeting',
        tier || 'manager',
        agent_id || 'unknown',
        agent_name || 'Unknown',
        color || '#3B82F6',
        recurring ? JSON.stringify(recurring) : null,
      ]
    );

    const event = queryOne('SELECT * FROM calendar_events WHERE id = ?', [id]);

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
