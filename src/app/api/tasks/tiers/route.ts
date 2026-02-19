import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

interface TaskWithTier {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  tier: string;
  manager_id?: string;
  subagent_type?: string;
  estimated_minutes?: number;
  actual_minutes?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  assignee_name?: string;
}

/**
 * GET /api/tasks/tiers
 * 
 * Returns tasks grouped by tier for the Tasks Board
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');
    const manager = searchParams.get('manager');
    const status = searchParams.get('status');

    let sql = `
      SELECT 
        t.id, t.title, t.description, t.status, t.priority, 
        t.tier, t.manager_id, t.subagent_type,
        t.estimated_minutes, t.actual_minutes,
        t.created_at, t.updated_at, t.completed_at,
        a.name as assignee_name
      FROM tasks t
      LEFT JOIN agents a ON t.assigned_agent_id = a.id
      WHERE 1=1
    `;
    
    const params: string[] = [];

    if (tier && tier !== 'all') {
      sql += ' AND t.tier = ?';
      params.push(tier);
    }

    if (manager && manager !== 'all') {
      sql += ' AND (t.manager_id = ? OR t.tier = ?)';
      params.push(manager, 'skippy');
    }

    if (status && status !== 'all') {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY t.priority DESC, t.created_at ASC';

    const tasks = queryAll<TaskWithTier>(sql, params);

    // Group by tier
    const byTier = {
      skippy: tasks.filter((t) => t.tier === 'skippy'),
      manager: tasks.filter((t) => t.tier === 'manager'),
      subagent: tasks.filter((t) => t.tier === 'subagent'),
    };

    return NextResponse.json({
      success: true,
      tasks,
      byTier,
      counts: {
        total: tasks.length,
        skippy: byTier.skippy.length,
        manager: byTier.manager.length,
        subagent: byTier.subagent.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch tasks by tier:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}
