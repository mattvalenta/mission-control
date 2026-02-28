import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_Gd2OXUYS7sbE@ep-dry-mountain-ae3fsqlh-pooler.c-2.us-east-2.aws.neon.tech/openclaw',
  ssl: { rejectUnauthorized: false },
});

/**
 * PATCH /api/social/[id]
 * Update a social media post (approve, edit, mark sent)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: string[] = [];
    const values: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (body.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(body.content);
    }
    if (body.approved !== undefined) {
      updates.push(`approved = $${paramIndex++}`);
      values.push(body.approved);
      if (body.approved) {
        updates.push(`approved_at = NOW()`);
        // Clear denied status if approving
        updates.push(`denied = FALSE`);
        updates.push(`denied_at = NULL`);
      }
    }
    if (body.denied !== undefined) {
      updates.push(`denied = $${paramIndex++}`);
      values.push(body.denied);
      if (body.denied) {
        updates.push(`denied_at = NOW()`);
        // Clear approved status if denying
        updates.push(`approved = FALSE`);
        updates.push(`approved_at = NULL`);
      }
    }
    if (body.sent !== undefined) {
      updates.push(`sent = $${paramIndex++}`);
      values.push(body.sent);
      if (body.sent) {
        updates.push(`sent_at = NOW()`);
      }
    }
    if (body.post_url !== undefined) {
      updates.push(`post_url = $${paramIndex++}`);
      values.push(body.post_url);
    }
    if (body.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(body.notes);
    }
    if (body.scheduled_date !== undefined) {
      updates.push(`scheduled_date = $${paramIndex++}`);
      values.push(body.scheduled_date);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);

    const result = await client.query(
      `UPDATE social_media_posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return NextResponse.json({ success: true, post: result.rows[0] });
  } catch (error) {
    console.error('Failed to update post:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/social/[id]
 * Delete a social media post
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await pool.connect();
  try {
    const { id } = await params;

    await client.query('DELETE FROM social_media_posts WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Failed to delete post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  } finally {
    client.release();
  }
}
