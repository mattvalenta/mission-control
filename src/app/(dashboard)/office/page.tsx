import { Metadata } from 'next';
import { Building2, Sun, Moon } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Office View | Mission Control',
  description: 'Visual representation of agents working',
};

export default function OfficePage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Office View</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-500">
            <Sun className="h-4 w-4" />
            Day
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-600">
            <Moon className="h-4 w-4" />
            Night
          </button>
        </div>
      </div>

      {/* Office Floor */}
      <div className="rounded-lg bg-slate-800 p-8">
        <div className="mb-4 text-center text-slate-400">🏢 MISSION CONTROL</div>

        {/* Desk Grid */}
        <div className="grid grid-cols-3 gap-6">
          {[
            { name: 'Skippy', icon: '🍺', status: 'TYPING', color: 'amber' },
            { name: 'Dev Manager', icon: '🔧', status: 'WORKING', color: 'blue' },
            { name: 'Marketing', icon: '📱', status: 'WORKING', color: 'green' },
            { name: 'Insights', icon: '📊', status: 'WORKING', color: 'purple' },
            { name: 'DevOps', icon: '⚙️', status: 'WORKING', color: 'blue' },
            { name: 'Community', icon: '💬', status: 'WORKING', color: 'green' },
            { name: 'Security', icon: '🔒', status: 'WORKING', color: 'blue' },
            { name: 'SEO', icon: '🔍', status: 'IDLE', color: 'green' },
            { name: 'Empty', icon: '', status: '', color: 'slate' },
          ].map((desk) => (
            <div
              key={desk.name}
              className={`rounded-lg border-2 border-${desk.color}-400 bg-slate-700 p-4 text-center ${
                desk.name === 'Empty' ? 'opacity-30' : 'cursor-pointer hover:bg-slate-600'
              }`}
            >
              {desk.icon && <div className="text-2xl">{desk.icon}</div>}
              <div className="mt-2 font-medium text-white">
                {desk.name === 'Empty' ? '[Empty Desk]' : desk.name}
              </div>
              {desk.status && (
                <div className="mt-1 text-xs text-green-400 animate-pulse">{desk.status}</div>
              )}
            </div>
          ))}
        </div>

        {/* Lounge Area */}
        <div className="mt-8 rounded-lg bg-slate-700 p-4 text-center text-slate-400">
          🛋️ Matt's Chair — Empty
        </div>

        {/* Status Footer */}
        <div className="mt-4 text-center text-sm text-slate-400">
          Status: 8 agents active, 10 on-demand
        </div>
      </div>
    </div>
  );
}
