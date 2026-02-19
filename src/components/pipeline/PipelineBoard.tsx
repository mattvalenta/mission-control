'use client';

import { Plus, Filter } from 'lucide-react';

const stages = [
  { id: 'idea', title: 'Ideas', count: 0 },
  { id: 'research', title: 'Research', count: 0 },
  { id: 'draft', title: 'Draft', count: 0 },
  { id: 'humanize', title: 'Humanize', count: 0 },
  { id: 'schedule', title: 'Schedule', count: 0 },
  { id: 'publish', title: 'Publish', count: 0 },
  { id: 'analysis', title: 'Analysis', count: 0 },
];

export default function PipelineBoard() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-mc-text">Content Pipeline</h2>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-mc-bg-tertiary rounded-lg text-mc-text-secondary hover:text-mc-text">
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-white rounded-lg hover:bg-mc-accent/90">
          <Plus className="w-4 h-4" />
          <span>New Idea</span>
        </button>
      </div>

      {/* Pipeline */}
      <div className="flex-1 flex gap-4 overflow-x-auto">
        {stages.map((stage) => (
          <div
            key={stage.id}
            className="flex-1 min-w-[200px] bg-mc-bg-secondary rounded-lg border border-mc-border"
          >
            {/* Stage Header */}
            <div className="p-3 border-b border-mc-border">
              <h3 className="font-medium text-mc-text">{stage.title}</h3>
              <p className="text-xs text-mc-text-secondary mt-1">{stage.count} items</p>
            </div>

            {/* Stage Content */}
            <div className="p-3 min-h-[200px]">
              <p className="text-sm text-mc-text-secondary text-center py-4">
                No items
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
