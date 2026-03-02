/**
 * Task Deliverables API with notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { notifyBoth } from '@/lib/db/notify-wrapper';
import { CreateDeliverableSchema } from '@/lib/validation';
import { existsSync } from 'fs';
import type { TaskDeliverable } from '@/lib/types';

// GET /api/tasks/[id]/deliverables - Retrieve all deliverables for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;

    const deliverables = await queryAll<TaskDeliverable>(
      'SELECT * FROM task_deliverables WHERE task_id = $1 ORDER BY created_at DESC',
      [taskId]
    );

    return NextResponse.json(deliverables);
  } catch (error) {
    console.error('Error fetching deliverables:', error);
    return NextResponse.json({ error: 'Failed to fetch deliverables' }, { status: 500 });
  }
}

// POST /api/tasks/[id]/deliverables - Add a new deliverable
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();
    
    const validation = CreateDeliverableSchema.safeParse(body);
    if (!validation.success) return NextResponse.json({ error: 'Validation failed', details: validation.error.issues }, { status: 400 });

    const { deliverable_type, title, path, description } = validation.data;

    let fileExists = true;
    let normalizedPath = path;
    if (deliverable_type === 'file' && path) {
      normalizedPath = path.replace(/^~/, process.env.HOME || '');
      fileExists = existsSync(normalizedPath);
      if (!fileExists) console.warn(`[DELIVERABLE] Warning: File does not exist: ${normalizedPath}`);
    }

    const id = crypto.randomUUID();

    await run(`INSERT INTO task_deliverables (id, task_id, deliverable_type, title, path, description, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, taskId, deliverable_type, title, path || null, description || null]
    );

    const deliverable = await queryOne<TaskDeliverable>('SELECT * FROM task_deliverables WHERE id = $1', [id]);

    // Broadcast deliverable via SSE + PostgreSQL NOTIFY
    await notifyBoth('deliverable_updates', 'deliverable_added', { taskId, deliverable });

    if (deliverable_type === 'file' && !fileExists) {
      return NextResponse.json({ ...deliverable, warning: `File does not exist: ${normalizedPath}` }, { status: 201 });
    }

    return NextResponse.json(deliverable, { status: 201 });
  } catch (error) {
    console.error('Error creating deliverable:', error);
    return NextResponse.json({ error: 'Failed to create deliverable' }, { status: 500 });
  }
}
