'use client';

import { Search, Folder, File, Edit2, Save, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface MemoryFile {
  agent: string;
  filename: string;
  path: string;
  size: number;
  modified: string;
}

interface SearchResult {
  agent: string;
  filename: string;
  path: string;
  matches: string[];
}

interface FileContent {
  path: string;
  content: string;
  size: number;
  modified: string;
}

const agentColors: Record<string, string> = {
  skippy: 'text-amber-400',
  'dev-manager': 'text-blue-400',
  'marketing-manager': 'text-green-400',
  'insights-manager': 'text-purple-400',
  workspace: 'text-slate-400',
};

export default function MemoryBrowser() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedAgents, setExpandedAgents] = useState<string[]>(['skippy', 'dev-manager']);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch('/api/memory');
      const data = await res.json();
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/memory?search=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const openFile = async (file: MemoryFile) => {
    try {
      const res = await fetch(`/api/memory/${file.path}`);
      const data = await res.json();
      if (data.success) {
        setSelectedFile(data.file);
        setEditContent(data.file.content);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const saveFile = async () => {
    if (!selectedFile) return;

    try {
      const res = await fetch(`/api/memory/${selectedFile.path}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        setSelectedFile({ ...selectedFile, content: editContent });
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const toggleAgent = (agent: string) => {
    setExpandedAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent]
    );
  };

  // Group files by agent
  const filesByAgent = files.reduce((acc, file) => {
    if (!acc[file.agent]) acc[file.agent] = [];
    acc[file.agent].push(file);
    return acc;
  }, {} as Record<string, MemoryFile[]>);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="h-full flex gap-4">
      {/* File Tree */}
      <div className="w-72 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b border-slate-700">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-slate-700 rounded px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-transparent border-none outline-none text-sm text-white placeholder-slate-400 w-full"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {isSearching ? '...' : 'Go'}
            </button>
          </div>
        </div>

        {/* Search Results or File Tree */}
        <div className="flex-1 overflow-auto p-2">
          {searchQuery && searchResults.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 px-2">{searchResults.length} files found</p>
              {searchResults.map((result) => (
                <button
                  key={`${result.agent}-${result.filename}`}
                  onClick={() => openFile({ agent: result.agent, filename: result.filename, path: result.path, size: 0, modified: '' })}
                  className="w-full text-left p-2 bg-slate-700 rounded hover:bg-slate-600"
                >
                  <p className={`text-sm font-medium ${agentColors[result.agent] || 'text-white'}`}>
                    {result.filename}
                  </p>
                  <p className="text-xs text-slate-400">{result.agent}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {result.matches[0]?.substring(0, 50)}...
                  </p>
                </button>
              ))}
            </div>
          ) : loading ? (
            <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
          ) : (
            Object.entries(filesByAgent).map(([agent, agentFiles]) => (
              <div key={agent}>
                <button
                  onClick={() => toggleAgent(agent)}
                  className="flex items-center gap-2 w-full p-2 text-left hover:bg-slate-700 rounded"
                >
                  <Folder className={`w-4 h-4 ${expandedAgents.includes(agent) ? 'text-blue-400' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${agentColors[agent] || 'text-white'}`}>
                    {agent}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">{agentFiles.length}</span>
                </button>
                {expandedAgents.includes(agent) && (
                  <div className="ml-4">
                    {agentFiles.map((file) => (
                      <button
                        key={file.path}
                        onClick={() => openFile(file)}
                        className={`flex items-center gap-2 w-full p-2 text-left rounded ${
                          selectedFile?.path === file.path
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        <File className="w-4 h-4" />
                        <span className="text-sm truncate">{file.filename}</span>
                        <span className="text-xs text-slate-500 ml-auto">{formatSize(file.size)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Document Viewer */}
      <div className="flex-1 bg-slate-800/50 rounded-lg border border-slate-700 flex flex-col">
        {selectedFile ? (
          <>
            {/* File Header */}
            <div className="p-3 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">{selectedFile.path}</h3>
                <p className="text-xs text-slate-400">
                  {formatSize(selectedFile.size)} • Modified {new Date(selectedFile.modified).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => {
                        setEditContent(selectedFile.content);
                        setIsEditing(false);
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={saveFile}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-500 text-sm"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                )}
              </div>
            </div>

            {/* File Content */}
            <div className="flex-1 overflow-auto p-4">
              {isEditing ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full h-full bg-transparent border-none outline-none text-slate-300 font-mono text-sm resize-none"
                />
              ) : (
                <pre className="text-slate-300 font-mono text-sm whitespace-pre-wrap">{selectedFile.content}</pre>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <File className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Select a file to view its contents</p>
              <p className="text-sm text-slate-500 mt-1">Or search for text across all files</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
