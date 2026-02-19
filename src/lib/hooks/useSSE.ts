'use client';

import { useEffect, useState, useCallback } from 'react';

interface SSEEvent {
  type: string;
  payload: unknown;
}

export function useSSE(url: string = '/api/events/stream') {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => [data, ...prev].slice(0, 100)); // Keep last 100 events
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
    };

    return () => {
      eventSource.close();
    };
  }, [url]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, error, clearEvents };
}

// Hook for subscribing to specific event types
export function useSSEEvents<T = unknown>(
  eventType: string,
  onEvent: (payload: T) => void
) {
  const { events } = useSSE();

  useEffect(() => {
    for (const event of events) {
      if (event.type === eventType && event.payload) {
        onEvent(event.payload as T);
      }
    }
  }, [events, eventType, onEvent]);
}

// Hook for task updates
export function useTaskUpdates(onUpdate: (task: unknown) => void) {
  useSSEEvents('task_updated', onUpdate);
  useSSEEvents('task_created', onUpdate);
}

// Hook for pipeline updates
export function usePipelineUpdates(onUpdate: (item: unknown) => void) {
  useSSEEvents('pipeline_updated', onUpdate);
}

// Hook for calendar updates
export function useCalendarUpdates(onUpdate: (event: unknown) => void) {
  useSSEEvents('calendar_updated', onUpdate);
}
