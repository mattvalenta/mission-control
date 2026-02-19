import { Metadata } from 'next';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Calendar | Mission Control',
  description: 'Visualize all scheduled tasks and cron jobs',
};

export default function CalendarPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-8 w-8 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-slate-700 p-2 text-slate-300 hover:bg-slate-600">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="px-4 py-2 text-slate-300">Thursday, February 19, 2026</span>
          <button className="rounded-lg bg-slate-700 p-2 text-slate-300 hover:bg-slate-600">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-2">
          {['Day', 'Week', 'Month'].map((view) => (
            <button
              key={view}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600"
            >
              {view}
            </button>
          ))}
        </div>
      </div>

      {/* Day View Placeholder */}
      <div className="rounded-lg bg-slate-800 p-4">
        <div className="space-y-2">
          {[
            { time: '06:00', title: '🔧 Dev Manager Daily Check-in', color: 'blue' },
            { time: '06:30', title: '🍺 Daily Self-Audit (Skippy)', color: 'amber' },
            { time: '07:00', title: '⬆️ Daily Auto-Update', color: 'slate' },
            { time: '08:00', title: '📱 Social Growth Session', color: 'green' },
            { time: '09:00', title: '🔒 Security Audit', color: 'blue' },
          ].map((event) => (
            <div
              key={event.time}
              className="flex items-center gap-4 rounded-lg bg-slate-700 p-3"
            >
              <span className="w-16 text-sm text-slate-400">{event.time}</span>
              <span className="text-slate-200">{event.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
