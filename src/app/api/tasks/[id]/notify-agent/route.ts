import { NextRequest, NextResponse } from 'next/server';
import { queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';

// Discord agent IDs (from MEMORY.md)
const AGENT_DISCORD_IDS: Record<string, string> = {
  // Managers
  'skippy': '1341233578008379392', // Actually Matt's ID, Skippy is the main agent
  'dev-manager': '1473422614944022684',
  'marketing-manager': '1473422881118748923',
  'insights-manager': '1473423045128360050',
  // Also support the full names
  'Dev Manager': '1473422614944022684',
  'Marketing Manager': '1473422881118748923',
  'Insights Manager': '1473423045128360050',
};

// Discord channel IDs for agent dedicated channels
const AGENT_CHANNELS: Record<string, string> = {
  'dev-manager': '1473425570422460449',
  'marketing-manager': '1473425604325019648',
  'insights-manager': '1473425629822058618',
  'Dev Manager': '1473425570422460449',
  'Marketing Manager': '1473425604325019648',
  'Insights Manager': '1473425629822058618',
};

// POST /api/tasks/[id]/notify-agent - Send Discord notification to agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { action, message } = body;

    const task = queryOne<{
      id: string;
      title: string;
      status: string;
      planning_stage?: string;
      assigned_agent_id?: string;
      optimized_description?: string;
    }>('SELECT * FROM tasks WHERE id = ?', [taskId]);

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get the assigned agent
    const agent = task.assigned_agent_id
      ? queryOne<{ id: string; name: string; avatar_emoji?: string }>(
          'SELECT * FROM agents WHERE id = ?',
          [task.assigned_agent_id]
        )
      : null;

    if (!agent) {
      return NextResponse.json({ error: 'No agent assigned' }, { status: 400 });
    }

    // Get Discord user ID and channel
    const discordUserId = AGENT_DISCORD_IDS[agent.name];
    const discordChannel = AGENT_CHANNELS[agent.name];

    if (!discordUserId || !discordChannel) {
      return NextResponse.json({ 
        error: 'Agent Discord ID not configured',
        agentName: agent.name,
        availableAgents: Object.keys(AGENT_DISCORD_IDS)
      }, { status: 400 });
    }

    // Build notification message
    let notificationMessage = '';
    
    if (action === 'assigned') {
      notificationMessage = `<@${discordUserId}> 🔔 **NEW TASK ASSIGNED**

**Title:** ${task.title}
**Status:** ${task.status}
**Stage:** ${task.planning_stage || 'user_planning'}
**Task ID:** ${taskId}

${message || 'Please review and start the task when ready.'}

**Mission Control:** https://loculicidally-unfluttering-clemmie.ngrok-free.dev`;
    } else if (action === 'reminder') {
      notificationMessage = `<@${discordUserId}> ⏰ **TASK REMINDER**

**Title:** ${task.title}
**Status:** ${task.status}
**Task ID:** ${taskId}

${message || 'Checking in on this task.'}`;
    } else if (action === 'heartbeat_check') {
      notificationMessage = `<@${discordUserId}> 💓 **HEARTBEAT CHECK**

Please check for pending or in-progress tasks:

**Mission Control:** https://loculicidally-unfluttering-clemmie.ngrok-free.dev/api/agents/${task.assigned_agent_id}/tasks`;
    }

    // For now, return the message that should be sent
    // In production, this would use the Discord API
    return NextResponse.json({
      success: true,
      notification: {
        channelId: discordChannel,
        userId: discordUserId,
        message: notificationMessage,
      },
      note: 'Return this to the caller to send via Discord API',
    });
  } catch (error) {
    console.error('Failed to notify agent:', error);
    return NextResponse.json({ error: 'Failed to notify agent' }, { status: 500 });
  }
}
