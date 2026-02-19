'use client';

import { Search, Folder, File } from 'lucide-react';
import { useState } from 'react';

const mockFiles = [
  { id: '1', name: 'skippy', type: 'folder', children: [
    { id: '1-1', name: 'MEMORY.md', type: 'file' },
    { id: '1-2', name: 'SOUL.md', type: 'file' },
    { id: '1-3', name: 'AGENTS.md', type: 'file' },
  ]},
  { id: '2', name: 'dev-manager', type: 'folder', children: [
    { id: '2-1', name: 'MEMORY.md', type: 'file' },
    { id: '2-2', name: 'SOUL.md', type: 'file' },
    { id: '2-3', name: 'AGENTS.md', type: 'file' },
  ]},
  { id: '3', name: 'marketing-manager', type: 'folder', children: [
    { id: '3-1', name: 'MEMORY.md', type: 'file' },
    { id: '3-2', name: 'SOUL.md', type: 'file' },
  ]},
  { id: '4', name: 'insights-manager', type: 'folder', children: [
    { id: '4-1', name: 'MEMORY.md', type: 'file' },
    { id: '4-2', name: 'SOUL.md', type: 'file' },
  ]},
];

export default function MemoryBrowser() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['1', '2']);

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex gap-4">
      {/* File Tree */}
      <div className="w-64 bg-mc-bg-secondary rounded-lg border border-mc-border overflow-hidden flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-mc-border">
          <div className="flex items-center gap-2 bg-mc-bg-tertiary rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-mc-text-secondary" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm text-mc-text placeholder-mc-text-secondary w-full"
            />
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-auto p-2">
          {mockFiles.map((item) => (
            <div key={item.id}>
              <button
                onClick={() => item.type === 'folder' && toggleFolder(item.id)}
                className="flex items-center gap-2 w-full p-2 text-left text-mc-text hover:bg-mc-bg-tertiary rounded"
              >
                <Folder className={`w-4 h-4 ${expandedFolders.includes(item.id) ? 'text-mc-accent' : 'text-mc-text-secondary'}`} />
                <span className="text-sm">{item.name}</span>
              </button>
              {item.type === 'folder' && expandedFolders.includes(item.id) && item.children && (
                <div className="ml-4">
                  {item.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setSelectedFile(child.id)}
                      className={`flex items-center gap-2 w-full p-2 text-left hover:bg-mc-bg-tertiary rounded ${
                        selectedFile === child.id ? 'text-mc-accent bg-mc-accent/10' : 'text-mc-text-secondary'
                      }`}
                    >
                      <File className="w-4 h-4" />
                      <span className="text-sm">{child.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 bg-mc-bg-secondary rounded-lg border border-mc-border p-6">
        {selectedFile ? (
          <div>
            <h3 className="text-lg font-medium text-mc-text mb-4">MEMORY.md</h3>
            <div className="prose prose-invert max-w-none">
              <p className="text-mc-text-secondary">Select a file to view its contents...</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-mc-text-secondary">Select a file to view its contents</p>
          </div>
        )}
      </div>
    </div>
  );
}
