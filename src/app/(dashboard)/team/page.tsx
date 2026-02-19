import { Metadata } from 'next';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Team Org Chart | Mission Control',
  description: 'Visualize the agent hierarchy',
};

export default function TeamPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Team Org Chart</h1>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500">
            Active
          </button>
          <button className="rounded-lg bg-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-600">
            All
          </button>
        </div>
      </div>

      {/* Org Chart Placeholder */}
      <div className="flex flex-col items-center gap-8">
        {/* Skippy (CEO) */}
        <div className="rounded-lg border-2 border-amber-400 bg-slate-800 p-4 text-center">
          <div className="text-2xl">🍺</div>
          <div className="mt-2 font-semibold text-white">SKIPPY</div>
          <div className="text-sm text-slate-400">CEO</div>
          <div className="mt-2 text-xs text-green-400">🟢 Active</div>
        </div>

        {/* Managers */}
        <div className="flex gap-8">
          {[
            { name: 'Dev Manager', icon: '🔧', role: 'CTO', color: 'blue' },
            { name: 'Marketing', icon: '📱', role: 'CMO', color: 'green' },
            { name: 'Insights', icon: '📊', role: 'Analytics', color: 'purple' },
          ].map((manager) => (
            <div
              key={manager.name}
              className={`rounded-lg border-2 border-${manager.color}-400 bg-slate-800 p-4 text-center`}
            >
              <div className="text-2xl">{manager.icon}</div>
              <div className="mt-2 font-semibold text-white">{manager.name}</div>
              <div className="text-sm text-slate-400">{manager.role}</div>
              <div className="mt-2 text-xs text-green-400">🟢 Active</div>
            </div>
          ))}
        </div>

        {/* Subagent Counts */}
        <div className="flex gap-8 text-slate-400">
          <div className="text-center">
            <div className="text-lg font-semibold">7 Subagents</div>
            <div className="text-xs">3 active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">7 Subagents</div>
            <div className="text-xs">4 active</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold">4 Subagents</div>
            <div className="text-xs">1 active</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 flex justify-center gap-6 text-sm text-slate-400">
        <span>🟢 Active</span>
        <span>⚪ On-Demand</span>
        <span>🔴 Offline</span>
      </div>
    </div>
  );
}
