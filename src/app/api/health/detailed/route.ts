/**
 * Detailed Health Check API
 * 
 * Returns comprehensive system status including:
 * - All online instances
 * - Database connection
 * - Job queue status
 * - Recent errors
 */

import { NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';

// GET /api/health/detailed
export async function GET() {
  try {
    // Check database connection
    const dbCheck = await queryOne<{ now: Date }>('SELECT NOW() as now');

    // Get active instances
    const instances = await queryAll<{
      id: string;
      agent_name: string;
      role: string;
      status: string;
      last_heartbeat: Date;
    }>(
      `SELECT id, agent_name, role, status, last_heartbeat 
       FROM mc_instances 
       WHERE last_heartbeat > NOW() - INTERVAL '5 minutes'
       ORDER BY last_heartbeat DESC`
    );

    // Get job queue status
    const jobStats = await queryOne<{
      pending: string;
      running: string;
      failed: string;
    }>(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
       FROM job_executions 
       WHERE started_at > NOW() - INTERVAL '1 hour'`
    );

    // Get recent DLQ items
    const dlqCount = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM dead_letter_queue WHERE resolved_at IS NULL`
    );

    // Get recent webhook failures
    const webhookFailures = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM webhook_deliveries 
       WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour'`
    );

    // Determine overall status
    const status = instances.length > 0 && dbCheck ? 'healthy' : 'degraded';

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: !!dbCheck,
        latency: dbCheck ? Date.now() - new Date(dbCheck.now).getTime() : null,
      },
      instances: {
        total: instances.length,
        online: instances.filter((i) => i.status === 'online').length,
        list: instances.map((i) => ({
          id: i.id,
          name: i.agent_name,
          role: i.role,
          status: i.status,
          lastHeartbeat: i.last_heartbeat,
          secondsSinceHeartbeat: i.last_heartbeat
            ? Math.floor((Date.now() - new Date(i.last_heartbeat).getTime()) / 1000)
            : null,
        })),
      },
      jobs: {
        pending: parseInt(jobStats?.pending || '0'),
        running: parseInt(jobStats?.running || '0'),
        failed: parseInt(jobStats?.failed || '0'),
      },
      dlq: {
        unresolved: parseInt(dlqCount?.count || '0'),
      },
      webhooks: {
        failuresLastHour: parseInt(webhookFailures?.count || '0'),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
