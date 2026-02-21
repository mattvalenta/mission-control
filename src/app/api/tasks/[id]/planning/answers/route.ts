import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne } from '@/lib/db';
import { broadcast } from '@/lib/events';

/**
 * POST /api/tasks/[id]/planning/answers
 * 
 * Called by Skippy to submit answers to agent planning questions
 * This is used during the agent planning phase
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { answers } = body;

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Answers array required' }, { status: 400 });
    }

    const task = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as {
      id: string;
      planning_messages?: string;
      planning_stage?: string;
      status?: string;
      assigned_agent_id?: string;
    } | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify this is agent planning phase
    if (task.planning_stage !== 'agent_planning') {
      return NextResponse.json({ 
        error: 'Task is not in agent planning phase',
        currentStage: task.planning_stage 
      }, { status: 400 });
    }

    // Get existing messages
    const messages = task.planning_messages ? JSON.parse(task.planning_messages) : [];

    // Add Skippy's answers
    for (const answer of answers) {
      messages.push({
        role: 'assistant',  // Skippy is the assistant in agent planning
        agentId: '3a90091a-a6e5-4abc-934e-117210d07d73', // Skippy's ID
        questionId: answer.questionId,
        content: answer.answer,
        timestamp: Date.now()
      });
    }

    // Mark agent planning as complete
    messages.push({
      role: 'system',
      type: 'agent_planning_complete',
      timestamp: Date.now()
    });

    // Update task - move to in_progress
    getDb().prepare(`
      UPDATE tasks
      SET planning_messages = ?,
          planning_stage = 'complete',
          status = 'in_progress',
          updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(messages), taskId);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });
    }

    // Add activity log
    getDb().prepare(`
      INSERT INTO task_activities (id, task_id, agent_id, activity_type, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      taskId,
      '3a90091a-a6e5-4abc-934e-117210d07d73',
      'status_changed',
      'Skippy answered agent planning questions. Task ready for execution.'
    );

    return NextResponse.json({
      success: true,
      message: 'Agent planning complete. Task moved to in_progress.',
      answersSubmitted: answers.length,
      status: 'in_progress'
    });
  } catch (error) {
    console.error('Failed to submit agent planning answers:', error);
    return NextResponse.json({ 
      error: 'Failed to submit answers: ' + (error as Error).message 
    }, { status: 500 });
  }
}
