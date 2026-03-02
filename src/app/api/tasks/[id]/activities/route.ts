import { NextRequest, NextResponse } from 'next/server';
import { getTaskActivities, logNote } from '@/lib/activity-logger';
import { queryOne } from '@/lib/db';
import type { Task } from '@/lib/types';

// GET /api/tasks/[id]/activities - Get all activities for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify task exists
    const task = await queryOne<Task>('SELECT id FROM tasks WHERE id = $1', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    const activities = await getTaskActivities(id);
    
    return NextResponse.json(activities);
  } catch (error) {
    console.error('Failed to fetch task activities:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/activities - Add a note to a task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Verify task exists
    const task = await queryOne<Task>('SELECT id FROM tasks WHERE id = $1', [id]);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    const { note, agent_id, agent_name } = body;
    
    if (!note || typeof note !== 'string') {
      return NextResponse.json({ error: 'Note is required' }, { status: 400 });
    }
    
    await logNote(id, note, agent_id, agent_name);
    
    const activities = await getTaskActivities(id);
    return NextResponse.json(activities, { status: 201 });
  } catch (error) {
    console.error('Failed to add note:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}