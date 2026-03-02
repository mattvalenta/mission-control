import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne, run } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/clarifications - Get clarifications (pending or all)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pending = searchParams.get('pending') === 'true';
    const taskId = searchParams.get('task_id');
    
    let query = 'SELECT c.*, t.title as task_title FROM clarification_queue c LEFT JOIN tasks t ON c.task_id = t.id WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (pending) query += ' AND c.answered_at IS NULL';
    
    if (taskId) {
      query += ` AND c.task_id = $${paramIndex++}`;
      params.push(taskId);
    }
    
    query += ' ORDER BY c.created_at DESC LIMIT 50';
    
    const items = await queryAll(query, params);
    return NextResponse.json(items);
  } catch (error) {
    console.error('Failed to fetch clarifications:', error);
    return NextResponse.json({ error: 'Failed to fetch clarifications' }, { status: 500 });
  }
}

/**
 * POST /api/clarifications - Create a new clarification request
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.question || !body.from_agent) {
      return NextResponse.json({ error: 'Missing required fields: question, from_agent' }, { status: 400 });
    }
    
    const id = uuidv4();
    
    await run(`
      INSERT INTO clarification_queue (id, task_id, from_agent, question, question_type, options, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [id, body.task_id || null, body.from_agent, body.question, body.question_type || 'multiple_choice', body.options ? JSON.stringify(body.options) : null]);
    
    // Notify Skippy
    const MASTER_CONTROLLER = process.env.MASTER_CONTROLLER_AGENT || 'skippy';
    await run(`
      INSERT INTO agent_messages (from_agent, to_agent, content, task_id, status, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [body.from_agent, MASTER_CONTROLLER, `CLARIFICATION REQUEST for task ${body.task_id || 'general'}:\n\n${body.question}`, body.task_id || null, 'pending']);
    
    const item = await queryOne('SELECT * FROM clarification_queue WHERE id = $1', [id]);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error('Failed to create clarification:', error);
    return NextResponse.json({ error: 'Failed to create clarification' }, { status: 500 });
  }
}
