/**
 * useNotifications Hook
 * 
 * React hook for subscribing to PostgreSQL notifications.
 * Automatically reconnects and handles cleanup.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import {
  startNotificationListener,
  stopNotificationListener,
  setupHybridSync,
  NotificationChannel,
  NotificationPayload,
} from '@/lib/db/notify';

export interface UseNotificationsOptions {
  enabled?: boolean;
  channels?: NotificationChannel[];
  useHybridSync?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, channels, useHybridSync = true } = options;
  const cleanupRef = useRef<(() => void) | null>(null);
  const store = useStore();

  const handleNotification = useCallback(
    (channel: NotificationChannel, payload: NotificationPayload) => {
      console.log(`[useNotifications] Received ${payload.type} on ${channel}`);

      // Update store based on notification type
      switch (payload.type) {
        case 'task_created':
        case 'task_updated':
          if (payload.data.task) {
            store.updateTask(payload.data.task);
          }
          break;

        case 'task_deleted':
          if (payload.data.taskId) {
            store.removeTask(payload.data.taskId);
          }
          break;

        case 'agent_status_changed':
          if (payload.data.agentId && payload.data.status) {
            store.updateAgentStatus(payload.data.agentId, payload.data.status);
          }
          break;

        case 'activity_logged':
          if (payload.data.activity) {
            store.addActivity(payload.data.activity);
          }
          break;

        case 'deliverable_added':
          if (payload.data.deliverable) {
            store.addDeliverable(payload.data.deliverable);
          }
          break;

        default:
          console.log(`[useNotifications] Unhandled type: ${payload.type}`);
      }
    },
    [store]
  );

  const fetchChangesSince = useCallback(async (since: number) => {
    try {
      // Fetch recent changes from API
      const response = await fetch(`/api/sync/changes?since=${since}`);
      if (!response.ok) return [];

      const data = await response.json();
      return data.changes || [];
    } catch (error) {
      console.error('[useNotifications] Failed to fetch changes:', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    if (useHybridSync) {
      // Use hybrid sync (notifications + poll fallback)
      cleanupRef.current = setupHybridSync(
        (changes) => {
          changes.forEach((payload) => {
            handleNotification('task_updates', payload);
          });
        },
        fetchChangesSince
      );
    } else {
      // Use notifications only
      startNotificationListener(handleNotification, channels);

      cleanupRef.current = () => {
        stopNotificationListener();
      };
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [enabled, channels, useHybridSync, handleNotification, fetchChangesSince]);

  return {
    isConnected: cleanupRef.current !== null,
    stop: () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    },
  };
}

export default useNotifications;
