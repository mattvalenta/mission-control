'use client';

import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { useSSEEvents } from '@/lib/hooks/useSSE';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  type: 'cron' | 'meeting' | 'deadline' | 'reminder';
  tier: 'skippy' | 'manager' | 'subagent';
  agent_name: string;
  color: string;
}

const tierColors: Record<string, string> = {
  skippy: 'border-tier-skippy bg-tier-skippy/20',
  manager: 'border-tier-manager bg-tier-manager/20',
  subagent: 'border-tier-subagent bg-tier-subagent/20',
};

const typeIcons: Record<string, string> = {
  cron: '🔄',
  meeting: '👥',
  deadline: '🎯',
  reminder: '🔔',
};

export default function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - 7);
      const end = new Date(currentDate);
      end.setDate(end.getDate() + 14);

      const res = await fetch(`/api/calendar?start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}`);
      const data = await res.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncCron = async () => {
    try {
      await fetch('/api/calendar/cron');
      fetchEvents();
    } catch (error) {
      console.error('Failed to sync cron:', error);
    }
  };

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getWeekDates = () => {
    const dates = [];
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => e.start_time.startsWith(dateStr));
  };

  const getEventsForHour = (date: Date, hour: number) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => {
      const eventDate = new Date(e.start_time);
      return e.start_time.startsWith(dateStr) && eventDate.getHours() === hour;
    });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  };

  const weekDates = getWeekDates();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Calendar</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-white px-3 font-medium">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={syncCron}
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded hover:text-white text-sm"
          >
            Sync Cron
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-800 rounded-lg border border-slate-700 p-1">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Week View */}
      <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
        {/* Days Header */}
        <div className="grid grid-cols-8 border-b border-slate-700 bg-slate-800">
          <div className="p-2 text-xs text-slate-500"></div>
          {weekDates.map((date, i) => (
            <div
              key={i}
              className={`p-2 text-center border-l border-slate-700 ${
                date.toDateString() === new Date().toDateString() ? 'bg-blue-900/30' : ''
              }`}
            >
              <div className="text-xs text-slate-400">{days[i]}</div>
              <div className={`text-sm font-medium ${date.toDateString() === new Date().toDateString() ? 'text-blue-400' : 'text-white'}`}>
                {date.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="flex-1 overflow-y-auto">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-slate-700/50 min-h-[60px]">
              <div className="p-2 text-xs text-slate-500 text-right pr-4 bg-slate-800/50">
                {formatHour(hour)}
              </div>
              {weekDates.map((date, i) => {
                const hourEvents = getEventsForHour(date, hour);
                return (
                  <div
                    key={i}
                    className={`border-l border-slate-700/50 p-1 ${
                      date.toDateString() === new Date().toDateString() && hour === new Date().getHours()
                        ? 'bg-blue-900/20'
                        : ''
                    }`}
                  >
                    {hourEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs p-1 rounded mb-1 border-l-2 truncate cursor-pointer hover:opacity-80 ${tierColors[event.tier]}`}
                        style={{ borderLeftColor: event.color }}
                        title={event.title}
                      >
                        <span className="mr-1">{typeIcons[event.type]}</span>
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-tier-skippy bg-tier-skippy/20" />
          <span>Skippy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-tier-manager bg-tier-manager/20" />
          <span>Managers</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-l-2 border-tier-subagent bg-tier-subagent/20" />
          <span>Subagents</span>
        </div>
        <span className="ml-auto">{events.length} events this week</span>
      </div>
    </div>
  );
}
