import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw',
  ssl: { rejectUnauthorized: false },
});

/**
 * GET /api/social/weeks
 * Get distinct week start dates for filtering
 */
export async function GET() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT DISTINCT week_start_date 
      FROM social_media_posts 
      ORDER BY week_start_date DESC
    `);

    return NextResponse.json({
      success: true,
      weeks: result.rows.map((r) => r.week_start_date),
    });
  } catch (error) {
    console.error('Failed to fetch weeks:', error);
    return NextResponse.json({ error: 'Failed to fetch weeks' }, { status: 500 });
  } finally {
    client.release();
  }
}
