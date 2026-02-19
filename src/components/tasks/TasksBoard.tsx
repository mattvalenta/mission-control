'use client';

import { Plus, Filter, LayoutGrid, List } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { TierBadge } from '@/components/shared/TierBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface Task {
  id: string;
  title: string;
  description?: string;
  tier: 'skippy' | 'manager' | 'subagent';
  managerId?: string;
  assignee: string;
  status: 'backlog' | 'planning' | 'in_progress' | 'complete' | 'blocked';
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  estimatedMinutes: number;
}

const mockTasks: Task[] = [
  { id: '1', title: 'Mission Control Implementation', tier: 'skippy', assignee: 'Skippy', status: 'in_progress', priority: 'p1', estimatedMinutes: 240 },
  { id: '2', title: 'DB Migration for new tables', tier: 'manager', managerId: 'dev-manager', assignee: 'Dev Manager', status: 'planning', priority: 'p2', estimatedMinutes: 120 },
  { id: '3', title: 'Dashboard UI refresh', tier: 'subagent', managerId: 'dev-manager', assignee: 'Frontend Dev', status: 'backlog', priority: 'p2', estimatedMinutes: 180 },
  { id: '4', title: 'LinkedIn campaign', tier: 'manager', managerId: 'marketing-manager', assignee: 'Marketing Mgr', status: 'in_progress', priority: 'p1', estimatedMinutes: 90 },
  { id: '5', title: 'Copy draft for X thread', tier: 'subagent', managerId: 'marketing-manager', assignee: 'Copywriter', status: 'complete', priority: 'p3', estimatedMinutes: 45 },
];

const columns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-slate-600' },
  { id: 'planning', title: 'Planning', color: 'bg-amber-600' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-600' },
  { id: 'complete', title: 'Complete', color: 'bg-green-600' },
];

const tierFilterOptions = [
  { value: 'all', label: 'All Tiers' },
  { value: 'skippy', label: 'Skippy' },
  { value: 'manager', label: 'Managers' },
  { value: 'subagent', label: 'Subagents' },
];

const managerFilterOptions = [
  { value: 'all', label: 'All Managers' },
  { value: 'dev-manager', label: 'Dev Manager' },
  { value: 'marketing-manager', label: 'Marketing' },
  { value: 'insights-manager', label: 'Insights' },
];

export default function TasksBoard() {
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [tierFilter, setTierFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const filteredTasks = tasks.filter((task) => {
    if (tierFilter !== 'all' && task.tier !== tierFilter) return false;
    if (managerFilter !== 'all' && task.managerId !== managerFilter && task.tier !== 'skippy') return false;
    return true;
  });

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as Task['status'];

    setTasks((prev) =>
      prev.map((task) =>
        task.id === draggableId ? { ...task, status: newStatus } : task
      )
    );
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'p1': return 'border-l-priority-p1';
      case 'p2': return 'border-l-priority-p2';
      case 'p3': return 'border-l-priority-p3';
      case 'p4': return 'border-l-priority-p4';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Tasks Board</h2>
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-4 mb-4 p-4 bg-slate-800 rounded-lg">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Tier</label>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
            >
              {tierFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Manager</label>
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
            >
              {managerFilterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex items-end">
            <span className="text-sm text-slate-400">
              {filteredTasks.length} tasks
            </span>
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter((t) => t.status === column.id);
            
            return (
              <div
                key={column.id}
                className="flex-1 min-w-[280px] max-w-[350px] bg-slate-800/50 rounded-lg flex flex-col"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`} />
                    <h3 className="font-medium text-white">{column.title}</h3>
                  </div>
                  <span className="text-sm text-slate-400 bg-slate-700 px-2 py-0.5 rounded">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column Content */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-3 space-y-3 overflow-y-auto min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-slate-700/30' : ''
                      }`}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-slate-800 rounded-lg p-3 border-l-4 ${getPriorityColor(task.priority)} ${
                                snapshot.isDragging ? 'shadow-lg shadow-blue-500/20' : ''
                              } hover:bg-slate-700 transition-colors cursor-pointer`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <TierBadge tier={task.tier} />
                                <span className="text-xs text-slate-400">
                                  {task.priority.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-white text-sm font-medium mb-2">{task.title}</p>
                              <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>{task.assignee}</span>
                                <span>⏱️ {formatTime(task.estimatedMinutes)}</span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
