import { NextRequest, NextResponse } from 'next/server';
import { queryAll, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
}

/**
 * GET /api/calendar/cron
 * Sync with OpenClaw cron jobs and return calendar events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end');

    // Calculate default end date (7 days from start)
    const defaultEnd = new Date(startDate);
    defaultEnd.setDate(defaultEnd.getDate() + 7);
    const end = endDate || defaultEnd.toISOString().split('T')[0];

    // Get existing calendar events
    const events = queryAll<CalendarEvent>(
      `SELECT id, title, start_time FROM calendar_events 
       WHERE date(start_time) >= date(?) 
       AND date(start_time) <= date(?)
       ORDER BY start_time ASC`,
      [startDate, end]
    );

    // Try to sync with OpenClaw cron API
    const cronEvents: unknown[] = [];
    try {
      const cronUrl = process.env.OPENCLAW_API_URL || 'http://localhost:18789';
      const cronResponse = await fetch(`${cronUrl}/api/cron`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (cronResponse.ok) {
        const cronData = await cronResponse.json();
        
        // Transform cron jobs to calendar events
        if (cronData.jobs && Array.isArray(cronData.jobs)) {
          for (const job of cronData.jobs) {
            // Create events for each day in range
            const current = new Date(startDate);
            const endDt = new Date(end);
            
            while (current <= endDt) {
              const eventTime = new Date(current);
              // Parse cron expression for time (simplified - assumes daily jobs)
              const hour = job.schedule?.hour || 6;
              const minute = job.schedule?.minute || 0;
              eventTime.setHours(hour, minute, 0, 0);

              // Check if event already exists
              const existing = events.find((e) => 
                e.title === job.name && 
                new Date(e.start_time).getTime() === eventTime.getTime()
              );

              if (!existing) {
                const newEvent = {
                  id: uuidv4(),
                  title: job.name || 'Scheduled Task',
                  description: job.text || '',
                  start_time: eventTime.toISOString(),
                  end_time: new Date(eventTime.getTime() + 30 * 60000).toISOString(),
                  type: 'cron',
                  tier: job.tier || 'manager',
                  agent_id: job.agent_id || 'dev-manager-001',
                  agent_name: job.agent_name || 'Dev Manager',
                  color: job.tier === 'skippy' ? '#FFD700' : '#3B82F6',
                  recurring: JSON.stringify({ frequency: 'daily', interval: 1 }),
                };

                // Insert into database
                run(
                  `INSERT OR IGNORE INTO calendar_events 
                   (id, title, description, start_time, end_time, type, tier, agent_id, agent_name, color, recurring)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    newEvent.id,
                    newEvent.title,
                    newEvent.description,
                    newEvent.start_time,
                    newEvent.end_time,
                    newEvent.type,
                    newEvent.tier,
                    newEvent.agent_id,
                    newEvent.agent_name,
                    newEvent.color,
                    newEvent.recurring,
                  ]
                );

                cronEvents.push(newEvent);
              }

              current.setDate(current.getDate() + 1);
            }
          }
        }
      }
    } catch (cronError) {
      console.log('[Calendar] Could not sync with OpenClaw cron API:', cronError);
    }

    // Fetch updated events
    const allEvents = queryAll(
      `SELECT * FROM calendar_events 
       WHERE date(start_time) >= date(?) 
       AND date(start_time) <= date(?)
       ORDER BY start_time ASC`,
      [startDate, end]
    );

    return NextResponse.json({
      success: true,
      events: allEvents,
      synced: cronEvents.length,
    });
  } catch (error) {
    console.error('Failed to fetch calendar events:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}
