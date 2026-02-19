import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

interface TeamMember {
  id: string;
  name: string;
  tier: string;
  role: string;
  manager_id?: string;
  status: string;
}

/**
 * GET /api/team
 * Get team hierarchy
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier');

    let sql = 'SELECT * FROM team_members WHERE 1=1';
    const params: string[] = [];

    if (tier) {
      sql += ' AND tier = ?';
      params.push(tier);
    }

    sql += ' ORDER BY tier, name';

    const members = queryAll<TeamMember>(sql, params);

    // Build hierarchy
    const hierarchy = {
      skippy: members.filter((m) => m.tier === 'skippy'),
      managers: members.filter((m) => m.tier === 'manager'),
      subagents: members.filter((m) => m.tier === 'subagent'),
    };

    return NextResponse.json({
      success: true,
      members,
      hierarchy,
      counts: {
        total: members.length,
        skippy: hierarchy.skippy.length,
        managers: hierarchy.managers.length,
        subagents: hierarchy.subagents.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch team:', error);
    return NextResponse.json({ error: 'Failed to fetch team' }, { status: 500 });
  }
}
