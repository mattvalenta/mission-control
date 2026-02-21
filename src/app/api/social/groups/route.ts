import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw',
  ssl: { rejectUnauthorized: false },
});

/**
 * GET /api/social/groups
 * Get post groups (LinkedIn + X pairs)
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');

    let sql = `
      SELECT 
        g.id, g.week_start_date, g.theme, g.content_category,
        lp.id as linkedin_id, lp.content as linkedin_content, 
        lp.approved as linkedin_approved, lp.sent as linkedin_sent,
        xp.id as x_id, xp.content as x_content,
        xp.approved as x_approved, xp.sent as x_sent
      FROM social_media_post_groups g
      LEFT JOIN social_media_posts lp ON lp.id = g.linkedin_post_id
      LEFT JOIN social_media_posts xp ON xp.id = g.x_post_id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (week) {
      sql += ` AND g.week_start_date = $1`;
      params.push(week);
    }

    sql += ` ORDER BY g.week_start_date ASC`;

    const result = await client.query(sql, params);

    return NextResponse.json({
      success: true,
      groups: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Failed to fetch post groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  } finally {
    client.release();
  }
}
