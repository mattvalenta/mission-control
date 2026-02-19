import { Metadata } from 'next';
import { FolderOpen, Search, Filter } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Memory Browser | Mission Control',
  description: 'Browse, search, and manage all memories',
};

export default function MemoryPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Memory Browser</h1>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search memories..."
              className="bg-transparent text-slate-200 outline-none placeholder:text-slate-400"
            />
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-600">
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* File Tree */}
        <div className="rounded-lg bg-slate-800 p-4">
          <h2 className="mb-4 font-semibold text-slate-300">Folders</h2>
          <div className="space-y-1 text-sm">
            <div className="cursor-pointer rounded bg-slate-700 p-2 text-slate-200">📁 memory/</div>
            <div className="cursor-pointer p-2 pl-6 text-slate-400 hover:text-slate-200">📄 02-19.md</div>
            <div className="cursor-pointer p-2 pl-6 text-slate-400 hover:text-slate-200">📄 02-18.md</div>
            <div className="cursor-pointer p-2 text-slate-400 hover:text-slate-200">📁 agents/</div>
            <div className="cursor-pointer p-2 text-slate-400 hover:text-slate-200">📄 MEMORY.md</div>
          </div>
        </div>

        {/* Document Viewer */}
        <div className="col-span-3 rounded-lg bg-slate-800 p-4">
          <h2 className="mb-4 font-semibold text-slate-300">Document Viewer</h2>
          <div className="prose prose-invert max-w-none">
            <div className="rounded-lg bg-slate-700 p-4 text-slate-300">
              <h3 className="mb-2 text-lg font-semibold text-white">Select a file to view</h3>
              <p className="text-slate-400">
                Choose a memory file from the sidebar to view its contents.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
