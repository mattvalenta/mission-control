import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw',
  ssl: { rejectUnauthorized: false },
});

interface SocialPost {
  id: number;
  week_start_date: string;
  platform: 'linkedin' | 'x';
  account: 'paramount' | 'trafficdriver' | 'matt_valenta';
  scheduled_date: string;
  content_category: string;
  content: string;
  approved: boolean;
  denied: boolean;
  sent: boolean;
  created_at: string;
  approved_at?: string;
  denied_at?: string;
  sent_at?: string;
  post_url?: string;
  notes?: string;
}

/**
 * GET /api/social
 * List social media posts with filters
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const account = searchParams.get('account');
    const approved = searchParams.get('approved');
    const denied = searchParams.get('denied');
    const sent = searchParams.get('sent');
    const week = searchParams.get('week');

    let sql = `
      SELECT p.*, 
        g.id as group_id, 
        g.theme as group_theme,
        CASE 
          WHEN p.platform = 'linkedin' THEN xp.id
          ELSE lp.id
        END as paired_post_id
      FROM social_media_posts p
      LEFT JOIN social_media_post_groups g 
        ON (p.id = g.linkedin_post_id OR p.id = g.x_post_id)
      LEFT JOIN social_media_posts lp ON lp.id = g.linkedin_post_id
      LEFT JOIN social_media_posts xp ON xp.id = g.x_post_id
      WHERE 1=1
    `;
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (platform) {
      sql += ` AND p.platform = $${paramIndex++}`;
      params.push(platform);
    }
    if (account) {
      sql += ` AND p.account = $${paramIndex++}`;
      params.push(account);
    }
    if (approved !== null && approved !== 'all') {
      sql += ` AND p.approved = $${paramIndex++}`;
      params.push(approved === 'true');
    }
    if (denied !== null && denied !== 'all') {
      sql += ` AND p.denied = $${paramIndex++}`;
      params.push(denied === 'true');
    }
    if (sent !== null && sent !== 'all') {
      sql += ` AND p.sent = $${paramIndex++}`;
      params.push(sent === 'true');
    }
    if (week) {
      sql += ` AND p.week_start_date = $${paramIndex++}`;
      params.push(week);
    }

    sql += ` ORDER BY p.scheduled_date ASC, p.platform ASC`;

    const result = await client.query(sql, params);

    return NextResponse.json({
      success: true,
      posts: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Failed to fetch social posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * POST /api/social
 * Create a new social media post
 */
export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { week_start_date, platform, account, scheduled_date, content_category, content, notes } = body;

    const result = await client.query(
      `INSERT INTO social_media_posts 
       (week_start_date, platform, account, scheduled_date, content_category, content, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [week_start_date, platform, account, scheduled_date, content_category, content, notes || null]
    );

    return NextResponse.json({ success: true, post: result.rows[0] });
  } catch (error) {
    console.error('Failed to create post:', error);
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 });
  } finally {
    client.release();
  }
}
