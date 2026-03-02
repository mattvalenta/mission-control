/**
 * Activity Logger for Tasks
 * 
 * Logs all task activities to task_activities table for audit trail.
 * Tracks who made changes, what type of change, and details.
 */

import { run, queryAll } from './db';
import { v4 as uuidv4 } from 'uuid';

export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'priority_changed'
  | 'description_updated'
  | 'title_updated'
  | 'due_date_set'
  | 'due_date_changed'
  | 'due_date_removed'
  | 'note_added'
  | 'task_completed'
  | 'task_reopened'
  | 'review_requested'
  | 'review_approved'
  | 'review_rejected'
  | 'deliverable_added'
  | 'planning_started'
  | 'planning_completed';

export interface ActivityLogInput {
  taskId: string;
  agentId?: string;
  agentName?: string;
  activityType: ActivityType;
  message: string;
  metadata?: Record<string, any>;
}

export interface TaskActivity {
  id: string;
  task_id: string;
  agent_id: string | null;
  agent_name: string | null;
  activity_type: string;
  message: string;
  metadata: Record<string, any> | null;
  created_at: Date;
}

/**
 * Log a task activity
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  const id = uuidv4();
  const timestamp = new Date().toISOString();
  
  await run(
    `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      input.taskId,
      input.agentId || null,
      input.activityType,
      input.message,
      input.metadata ? JSON.stringify(input.metadata) : null,
      timestamp
    ]
  );
}

/**
 * Log a status change with details
 */
export async function logStatusChange(
  taskId: string,
  previousStatus: string,
  newStatus: string,
  agentId?: string,
  agentName?: string,
  notes?: string
): Promise<void> {
  const activityType = newStatus === 'done' ? 'task_completed' : 
                       previousStatus === 'done' ? 'task_reopened' : 
                       'status_changed';
  
  await logActivity({
    taskId,
    agentId,
    agentName,
    activityType,
    message: `Status changed from "${previousStatus}" to "${newStatus}"${notes ? `: ${notes}` : ''}`,
    metadata: { previousStatus, newStatus, notes }
  });
}

/**
 * Log an assignment change
 */
export async function logAssignment(
  taskId: string,
  previousAgentId: string | null,
  newAgentId: string | null,
  previousAgentName: string | null,
  newAgentName: string | null,
  assignedBy?: string,
  assignedByName?: string
): Promise<void> {
  const activityType = newAgentId ? 'assigned' : 'unassigned';
  const message = newAgentName 
    ? `Assigned to ${newAgentName}${assignedByName ? ` by ${assignedByName}` : ''}`
    : `Unassigned${assignedByName ? ` by ${assignedByName}` : ''}`;
  
  await logActivity({
    taskId,
    agentId: assignedBy || undefined,
    agentName: assignedByName,
    activityType,
    message,
    metadata: { previousAgentId, newAgentId, previousAgentName, newAgentName }
  });
}

/**
 * Log a note/comment addition
 */
export async function logNote(
  taskId: string,
  note: string,
  agentId?: string,
  agentName?: string
): Promise<void> {
  await logActivity({
    taskId,
    agentId,
    agentName,
    activityType: 'note_added',
    message: note.length > 200 ? note.substring(0, 200) + '...' : note,
    metadata: { fullNote: note }
  });
}

/**
 * Get all activities for a task
 */
export async function getTaskActivities(taskId: string, limit = 50): Promise<TaskActivity[]> {
  const activities = await queryAll<TaskActivity>(
    `SELECT 
      ta.id, 
      ta.task_id, 
      ta.agent_id, 
      a.name as agent_name,
      ta.activity_type, 
      ta.message, 
      ta.metadata, 
      ta.created_at
    FROM task_activities ta
    LEFT JOIN agents a ON ta.agent_id = a.id
    WHERE ta.task_id = $1
    ORDER BY ta.created_at DESC
    LIMIT $2`,
    [taskId, limit]
  );
  
  return activities;
}

/**
 * Get recent activities across all tasks
 */
export async function getRecentActivities(limit = 100): Promise<TaskActivity[]> {
  const activities = await queryAll<TaskActivity>(
    `SELECT 
      ta.id, 
      ta.task_id, 
      ta.agent_id, 
      a.name as agent_name,
      ta.activity_type, 
      ta.message, 
      ta.metadata, 
      ta.created_at,
      t.title as task_title
    FROM task_activities ta
    LEFT JOIN agents a ON ta.agent_id = a.id
    LEFT JOIN tasks t ON ta.task_id = t.id
    ORDER BY ta.created_at DESC
    LIMIT $1`,
    [limit]
  );
  
  return activities;
}