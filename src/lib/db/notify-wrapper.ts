/**
 * Notification wrapper for API routes
 * 
 * Combines SSE broadcast with PostgreSQL NOTIFY
 */

import { broadcast } from '@/lib/events';
import { broadcastNotification, NotificationChannel, NotificationType } from './notify';

/**
 * Broadcast to both SSE and PostgreSQL NOTIFY
 */
export async function notifyBoth(
  channel: NotificationChannel,
  type: NotificationType,
  data: Record<string, any>
): Promise<void> {
  // SSE broadcast (for frontend)
  broadcast({ type, payload: data });

  // PostgreSQL NOTIFY (for other MC instances)
  try {
    await broadcastNotification(channel, type, data);
  } catch (error) {
    console.error('[notifyBoth] NOTIFY failed:', error);
    // Don't throw - SSE broadcast succeeded
  }
}
