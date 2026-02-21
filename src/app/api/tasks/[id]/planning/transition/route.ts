import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// Discord agent IDs and channels
const AGENT_DISCORD_IDS: Record<string, string> = {
  'dev-manager': '1473422614944022684',
  'marketing-manager': '1473422881118748923',
  'insights-manager': '1473423045128360050',
  'Dev Manager': '1473422614944022684',
  'Marketing Manager': '1473422881118748923',
  'Insights Manager': '1473423045128360050',
};

const AGENT_CHANNELS: Record<string, string> = {
  'dev-manager': '1473425570422460449',
  'marketing-manager': '1473425604325019648',
  'insights-manager': '1473425629822058618',
  'Dev Manager': '1473425570422460449',
  'Marketing Manager': '1473425604325019648',
  'Insights Manager': '1473425629822058618',
};

// Send Discord notification via OpenClaw message tool
async function sendDiscordNotification(channelId: string, message: string) {
  const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL || 'http://127.0.0.1:18789';
  
  try {
    // Use OpenClaw's internal messaging API
    const response = await fetch(`${gatewayUrl}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        channel: 'discord',
        to: channelId,
        message: message,
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to send Discord notification:', await response.text());
      return false;
    }
    
    console.log('Discord notification sent to channel:', channelId);
    return true;
  } catch (error) {
    console.error('Error sending Discord notification:', error);
    return false;
  }
}

// POST /api/tasks/[id]/planning/transition - Transition from Stage 1 to Stage 2
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { optimizedDescription, assignedAgentId } = body;

    if (!optimizedDescription) {
      return NextResponse.json({ error: 'Optimized description required' }, { status: 400 });
    }
    if (!assignedAgentId) {
      return NextResponse.json({ error: 'Assigned agent required' }, { status: 400 });
    }

    const task = queryOne<{
      id: string;
      title: string;
      planning_stage?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Verify we're in user_planning stage
    if (task.planning_stage !== 'user_planning') {
      return NextResponse.json({ 
        error: 'Can only transition from user_planning stage',
        currentStage: task.planning_stage 
      }, { status: 400 });
    }

    // Get the assigned agent info
    const agent = queryOne<{
      id: string;
      name: string;
      avatar_emoji: string;
    }>('SELECT * FROM agents WHERE id = ?', [assignedAgentId]);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Update task with optimized description and new assignee
    run(`
      UPDATE tasks
      SET planning_stage = 'agent_planning',
          optimized_description = ?,
          assigned_agent_id = ?,
          planning_session_key = NULL,
          planning_messages = NULL,
          description = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [optimizedDescription, assignedAgentId, optimizedDescription, taskId]);

    // Broadcast update
    const updatedTask = queryOne('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: updatedTask as any,
      });

      // Add event for the feed
      run(`
        INSERT INTO events (id, type, task_id, message, created_at)
        VALUES (?, 'task_assigned', ?, ?, datetime('now'))
      `, [crypto.randomUUID(), taskId, `Task assigned to ${agent.name} after user planning`]);
    }

    // Send Discord notification
    const discordUserId = AGENT_DISCORD_IDS[agent.name];
    const discordChannel = AGENT_CHANNELS[agent.name];
    let notificationSent = false;

    if (discordUserId && discordChannel) {
      const notificationMessage = `<@${discordUserId}> 🔔 **NEW TASK ASSIGNED**

**Title:** ${task.title}
**Status:** planning
**Stage:** agent_planning
**Task ID:** ${taskId}

Your planning expertise is needed. Review the optimized description and answer any clarifying questions.

**Mission Control:** https://loculicidally-unfluttering-clemmie.ngrok-free.dev`;

      notificationSent = await sendDiscordNotification(discordChannel, notificationMessage);
    }

    return NextResponse.json({
      success: true,
      message: `Task optimized and assigned to ${agent.name}. Agent planning stage ready.`,
      planningStage: 'agent_planning',
      assignedAgent: agent,
      notificationSent,
    });
  } catch (error) {
    console.error('Failed to transition planning:', error);
    return NextResponse.json({ error: 'Failed to transition planning' }, { status: 500 });
  }
}
