import { Metadata } from 'next';
import { CheckSquare, Plus, Filter } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Tasks Board | Mission Control',
  description: 'Multi-tier task visibility across the agent hierarchy',
};

export default function TasksPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Tasks Board</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-600">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500">
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Kanban Board Placeholder */}
      <div className="grid grid-cols-4 gap-4">
        {['Backlog', 'Planning', 'In Progress', 'Complete'].map((column) => (
          <div key={column} className="rounded-lg bg-slate-800 p-4">
            <h2 className="mb-4 font-semibold text-slate-300">{column}</h2>
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-700 p-3 text-slate-300">
                <div className="mb-2 text-xs font-medium text-amber-400">[SKIPPY]</div>
                <div className="text-sm">Sample task card</div>
                <div className="mt-2 text-xs text-slate-400">⏱️ 2h</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
