import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({ 
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clarifications/[id]
 * Get a specific clarification
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(`
      SELECT c.*, t.title as task_title, t.description as task_description
      FROM clarification_queue c
      LEFT JOIN mc_tasks t ON c.task_id = t.id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch clarification:', error);
    return NextResponse.json({ error: 'Failed to fetch clarification' }, { status: 500 });
  }
}

/**
 * PATCH /api/clarifications/[id]
 * Answer a clarification
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!body.answer) {
      return NextResponse.json(
        { error: 'Missing required field: answer' },
        { status: 400 }
      );
    }
    
    // Get current clarification
    const current = await pool.query(
      'SELECT * FROM clarification_queue WHERE id = $1',
      [id]
    );
    
    if (current.rows.length === 0) {
      return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
    }
    
    const clarification = current.rows[0];
    
    // Update clarification
    const result = await pool.query(`
      UPDATE clarification_queue
      SET answer = $1, 
          answered_by = $2, 
          answered_at = NOW(),
          escalated = $3
      WHERE id = $4
      RETURNING *
    `, [
      body.answer,
      body.answered_by || 'skippy',
      body.escalated || false,
      id
    ]);
    
    // Notify the requesting agent via agent_messages
    await pool.query(`
      INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      body.answered_by || 'skippy',
      clarification.from_agent,
      `CLARIFICATION ANSWER: ${body.answer}`,
      clarification.task_id,
      'pending'
    ]);
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to answer clarification:', error);
    return NextResponse.json({ error: 'Failed to answer clarification' }, { status: 500 });
  }
}

/**
 * DELETE /api/clarifications/[id]
 * Cancel/remove a clarification
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    
    const result = await pool.query(
      'DELETE FROM clarification_queue WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Clarification not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Failed to delete clarification:', error);
    return NextResponse.json({ error: 'Failed to delete clarification' }, { status: 500 });
  }
}
