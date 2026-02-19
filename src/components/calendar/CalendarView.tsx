'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

type ViewMode = 'day' | 'week' | 'month';

export default function CalendarView() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-mc-text">Calendar</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}
              className="p-2 text-mc-text-secondary hover:text-mc-text"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-mc-text px-2">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}
              className="p-2 text-mc-text-secondary hover:text-mc-text"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-mc-bg-secondary rounded-lg border border-mc-border p-1">
          {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-md text-sm ${
                viewMode === mode
                  ? 'bg-mc-accent text-white'
                  : 'text-mc-text-secondary hover:text-mc-text'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-mc-bg-secondary rounded-lg border border-mc-border overflow-auto">
        {/* Days Header */}
        <div className="grid grid-cols-8 border-b border-mc-border sticky top-0 bg-mc-bg-secondary">
          <div className="p-2 text-xs text-mc-text-secondary"></div>
          {days.map((day) => (
            <div key={day} className="p-2 text-xs text-mc-text-secondary text-center border-l border-mc-border">
              {day}
            </div>
          ))}
        </div>

        {/* Time Grid */}
        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b border-mc-border min-h-[60px]">
              <div className="p-2 text-xs text-mc-text-secondary text-right pr-4">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </div>
              {days.map((_, i) => (
                <div key={i} className="border-l border-mc-border"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
