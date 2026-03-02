/**
 * Scheduler Job API
 * 
 * GET: Get job details
 * POST: Manually trigger a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { claimAndRunJob } from '@/lib/scheduler';

// GET /api/scheduler/[id] - Get job details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const job = await queryOne(
      'SELECT * FROM job_status_view WHERE id = $1 OR name = $1',
      [id]
    );

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Get recent executions
    const executions = await queryOne<{ rows: Array<{ id: string; status: string; started_at: string; completed_at: string | null; error: string | null }> }>(
      `SELECT id, status, started_at, completed_at, error 
       FROM job_executions 
       WHERE job_id = $1 
       ORDER BY started_at DESC 
       LIMIT 10`,
      [job.id]
    );

    return NextResponse.json({
      success: true,
      job,
      recentExecutions: executions?.rows || [],
    });
  } catch (error) {
    console.error('Failed to get job details:', error);
    return NextResponse.json({ 
      error: 'Failed to get job details' 
    }, { status: 500 });
  }
}

// POST /api/scheduler/[id] - Manually trigger job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get job name
    const job = await queryOne<{ name: string }>(
      'SELECT name FROM scheduled_jobs WHERE id = $1 OR name = $1',
      [id]
    );

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Try to claim and run
    const ran = await claimAndRunJob(job.name);

    if (!ran) {
      return NextResponse.json({ 
        error: 'Job is already running or locked by another instance' 
      }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${job.name} completed`,
    });
  } catch (error) {
    console.error('Failed to run job:', error);
    return NextResponse.json({ 
      error: 'Failed to run job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// PUT /api/scheduler/[id] - Update job (enable/disable)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { enabled } = body;

    const result = await run(
      'UPDATE scheduled_jobs SET enabled = $1 WHERE id = $2 OR name = $2',
      [enabled, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Job ${enabled ? 'enabled' : 'disabled'}`,
    });
  } catch (error) {
    console.error('Failed to update job:', error);
    return NextResponse.json({ 
      error: 'Failed to update job' 
    }, { status: 500 });
  }
}
