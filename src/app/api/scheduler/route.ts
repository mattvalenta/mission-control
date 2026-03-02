/**
 * Scheduler API
 * 
 * GET: List all jobs and their status
 * POST: Run pending jobs (manual trigger)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus, getPendingJobs, claimAndRunJob } from '@/lib/scheduler';

// GET /api/scheduler - List all jobs
export async function GET() {
  try {
    const jobs = await getJobStatus();

    return NextResponse.json({
      success: true,
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('Failed to get job status:', error);
    return NextResponse.json({ 
      error: 'Failed to get job status' 
    }, { status: 500 });
  }
}

// POST /api/scheduler - Run pending jobs
export async function POST() {
  try {
    const pendingJobs = await getPendingJobs();
    const results: Array<{ name: string; ran: boolean; error?: string }> = [];

    for (const job of pendingJobs) {
      try {
        const ran = await claimAndRunJob(job.name);
        results.push({ name: job.name, ran });
      } catch (err) {
        results.push({ 
          name: job.name, 
          ran: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Failed to run pending jobs:', error);
    return NextResponse.json({ 
      error: 'Failed to run pending jobs' 
    }, { status: 500 });
  }
}
