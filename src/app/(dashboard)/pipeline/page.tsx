import { Metadata } from 'next';
import { FileText, Plus, Filter } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Content Pipeline | Mission Control',
  description: 'Track content creation from idea to publish',
};

const stages = [
  { name: 'Ideas', count: 5 },
  { name: 'Research', count: 2 },
  { name: 'Draft', count: 3 },
  { name: 'Humanize', count: 1 },
  { name: 'Schedule', count: 4 },
  { name: 'Publish', count: 8 },
  { name: 'Analysis', count: 3 },
];

export default function PipelinePage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-green-400" />
          <h1 className="text-2xl font-bold text-white">Content Pipeline</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-600">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-500">
            <Plus className="h-4 w-4" />
            New Idea
          </button>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.name} className="w-64 flex-shrink-0 rounded-lg bg-slate-800 p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-300">{stage.name}</h2>
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                {stage.count}
              </span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-700 p-3 text-slate-300">
                <div className="text-sm">Sample content item</div>
                <div className="mt-2 text-xs text-slate-400">📝 LinkedIn</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
