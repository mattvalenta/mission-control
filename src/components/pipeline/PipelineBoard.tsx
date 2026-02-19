'use client';

import { Plus, Filter, Sparkles, Search, Edit2, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ContentItem {
  id: string;
  title: string;
  type: 'linkedin_post' | 'x_post' | 'x_thread' | 'carousel' | 'blog';
  platform: 'linkedin' | 'x' | 'facebook' | 'instagram';
  stage: 'idea' | 'research' | 'draft' | 'humanize' | 'schedule' | 'publish' | 'analysis';
  assigned_to?: string;
  created_at: string;
}

const stages = [
  { id: 'idea', title: 'Ideas', icon: '💡' },
  { id: 'research', title: 'Research', icon: '🔍' },
  { id: 'draft', title: 'Draft', icon: '✍️' },
  { id: 'humanize', title: 'Humanize', icon: '🤖' },
  { id: 'schedule', title: 'Schedule', icon: '📅' },
  { id: 'publish', title: 'Publish', icon: '🚀' },
  { id: 'analysis', title: 'Analysis', icon: '📊' },
];

const typeIcons: Record<string, string> = {
  linkedin_post: '💼',
  x_post: '🐦',
  x_thread: '🧵',
  carousel: '🎠',
  blog: '📝',
};

const platformColors: Record<string, string> = {
  linkedin: 'bg-blue-600',
  x: 'bg-slate-800',
  facebook: 'bg-blue-500',
  instagram: 'bg-pink-600',
};

export default function PipelineBoard() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newItem, setNewItem] = useState({
    title: '',
    type: 'linkedin_post' as ContentItem['type'],
    platform: 'linkedin' as ContentItem['platform'],
  });

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    try {
      const res = await fetch('/api/pipeline');
      const data = await res.json();
      if (data.success) {
        setItems(data.items);
      }
    } catch (error) {
      console.error('Failed to fetch pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStage = destination.droppableId as ContentItem['stage'];

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === draggableId ? { ...item, stage: newStage } : item
      )
    );

    // API update
    try {
      await fetch(`/api/pipeline/${draggableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });
    } catch (error) {
      console.error('Failed to update stage:', error);
      // Revert on error
      fetchPipeline();
    }
  };

  const handleCreate = async () => {
    if (!newItem.title.trim()) return;

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (res.ok) {
        setShowNewModal(false);
        setNewItem({ title: '', type: 'linkedin_post', platform: 'linkedin' });
        fetchPipeline();
      }
    } catch (error) {
      console.error('Failed to create item:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item?')) return;

    try {
      await fetch(`/api/pipeline/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const getStageItems = (stageId: string) => items.filter((item) => item.stage === stageId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <h2 className="text-2xl font-bold text-white">Content Pipeline</h2>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Idea</span>
        </button>
      </div>

      {/* Pipeline Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="flex-1 min-w-[200px] max-w-[280px] bg-slate-800/50 rounded-lg flex flex-col"
            >
              {/* Stage Header */}
              <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{stage.icon}</span>
                  <h3 className="font-medium text-white">{stage.title}</h3>
                </div>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                  {getStageItems(stage.id).length}
                </span>
              </div>

              {/* Stage Content */}
              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-2 space-y-2 overflow-y-auto min-h-[150px] ${
                      snapshot.isDraggingOver ? 'bg-blue-900/20' : ''
                    }`}
                  >
                    {loading ? (
                      <div className="text-center text-slate-400 py-4">Loading...</div>
                    ) : (
                      getStageItems(stage.id).map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-slate-700 rounded-lg p-3 ${
                                snapshot.isDragging ? 'shadow-lg shadow-blue-500/30' : ''
                              } hover:bg-slate-600 transition-colors group`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-lg">{typeIcons[item.type]}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button className="p-1 text-slate-400 hover:text-white">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item.id);
                                    }}
                                    className="p-1 text-slate-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-white font-medium line-clamp-2">{item.title}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <span className={`text-xs px-2 py-0.5 rounded text-white ${platformColors[item.platform]}`}>
                                  {item.platform}
                                </span>
                                {item.assigned_to && (
                                  <span className="text-xs text-slate-400">{item.assigned_to}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* New Item Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">New Content Idea</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">Title</label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2"
                  placeholder="Content idea..."
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Type</label>
                <select
                  value={newItem.type}
                  onChange={(e) => setNewItem({ ...newItem, type: e.target.value as ContentItem['type'] })}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2"
                >
                  <option value="linkedin_post">LinkedIn Post</option>
                  <option value="x_post">X (Twitter) Post</option>
                  <option value="x_thread">X Thread</option>
                  <option value="carousel">Carousel</option>
                  <option value="blog">Blog Post</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-1 block">Platform</label>
                <select
                  value={newItem.platform}
                  onChange={(e) => setNewItem({ ...newItem, platform: e.target.value as ContentItem['platform'] })}
                  className="w-full bg-slate-700 text-white rounded px-3 py-2"
                >
                  <option value="linkedin">LinkedIn</option>
                  <option value="x">X (Twitter)</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
