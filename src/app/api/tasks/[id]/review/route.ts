/**
 * Quality Review API
 * Submit a quality review for a task
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { notifyBoth } from '@/lib/db/notify-wrapper';

// POST /api/tasks/[id]/review - Submit a quality review
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: taskId } = await params;
    const body = await request.json();
    const { status, notes, reviewer_id } = body;

    // Validate status
    const validStatuses = ['approved', 'rejected', 'changes_requested'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: 'Invalid status. Must be: approved, rejected, or changes_requested' 
      }, { status: 400 });
    }

    // Check task exists
    const task = await queryOne<{ id: string; status: string; title: string }>(
      'SELECT id, status, title FROM tasks WHERE id = $1',
      [taskId]
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Validate task is in reviewable state
    const reviewableStates = ['review', 'quality_review'];
    if (!reviewableStates.includes(task.status)) {
      return NextResponse.json({ 
        error: `Task must be in 'review' or 'quality_review' state. Current: ${task.status}` 
      }, { status: 400 });
    }

    // Create review record
    const reviewId = crypto.randomUUID();
    
    await run(
      `INSERT INTO quality_reviews (id, task_id, reviewer_id, status, notes, reviewed_at, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [reviewId, taskId, reviewer_id || null, status, notes || null]
    );

    // Update task status based on review
    let newTaskStatus = task.status;

    if (status === 'approved') {
      // Check if this is the final approval (from master agent)
      if (reviewer_id) {
        const reviewer = await queryOne<{ is_master: boolean }>(
          'SELECT is_master FROM agents WHERE id = $1',
          [reviewer_id]
        );

        if (reviewer?.is_master) {
          // Master agent approves → done
          newTaskStatus = 'done';
        } else {
          // Regular reviewer approves → quality_review (awaits master)
          newTaskStatus = 'quality_review';
        }
      } else {
        // No reviewer ID → quality_review
        newTaskStatus = 'quality_review';
      }
    } else if (status === 'rejected' || status === 'changes_requested') {
      // Rejection → back to in_progress
      newTaskStatus = 'in_progress';
    }

    // Update task status
    await run(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2',
      [newTaskStatus, taskId]
    );

    // Notify
    await notifyBoth('task_updates', 'task_reviewed', {
      taskId,
      reviewStatus: status,
      newTaskStatus,
      reviewerId: reviewer_id,
    });

    // Fetch created review
    const review = await queryOne(
      'SELECT * FROM quality_reviews WHERE id = $1',
      [reviewId]
    );

    return NextResponse.json({
      success: true,
      review,
      taskStatus: newTaskStatus,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to submit review:', error);
    return NextResponse.json({ 
      error: 'Failed to submit review' 
    }, { status: 500 });
  }
}
