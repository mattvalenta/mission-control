'use client';

import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'active' | 'idle' | 'on-demand' | 'offline';
  activity: string;
  task?: string;
}

const mockAgents: Agent[] = [
  { id: 'skippy', name: 'Skippy', emoji: '👑', role: 'CEO Agent', status: 'active', activity: 'typing', task: 'Task #47' },
  { id: 'dev-manager', name: 'Dev Manager', emoji: '💻', role: 'CTO/Tech Lead', status: 'active', activity: 'working', task: 'MC-001' },
  { id: 'marketing-manager', name: 'Marketing Manager', emoji: '📱', role: 'Marketing Lead', status: 'idle', activity: 'idle' },
  { id: 'insights-manager', name: 'Insights Manager', emoji: '📊', role: 'Analytics Lead', status: 'offline', activity: 'offline' },
  { id: 'frontend-dev', name: 'Frontend Dev', emoji: '🎨', role: 'UI Developer', status: 'active', activity: 'working', task: 'Dashboard UI' },
  { id: 'backend-dev', name: 'Backend Dev', emoji: '📝', role: 'API Developer', status: 'active', activity: 'coding', task: 'API refactor' },
  { id: 'qa-agent', name: 'QA Agent', emoji: '🔍', role: 'Testing', status: 'on-demand', activity: 'sleep' },
  { id: 'rpa-dev', name: 'RPA Developer', emoji: '📋', role: 'Automation', status: 'active', activity: 'working', task: 'Scraper v2' },
  { id: 'researcher', name: 'Researcher', emoji: '🔍', role: 'Content Research', status: 'active', activity: 'search' },
  { id: 'copywriter', name: 'Copywriter', emoji: '🎬', role: 'Content Writing', status: 'idle', activity: 'edit' },
];

export default function OfficeView() {
  const [isNightMode, setIsNightMode] = useState(false);

  const activityEmojis: Record<string, string> = {
    typing: '⌨️',
    working: '💼',
    coding: '💻',
    search: '🔍',
    edit: '✏️',
    idle: '💤',
    sleep: '😴',
    offline: '○',
  };

  return (
    <div className={`h-full flex flex-col rounded-lg ${isNightMode ? 'bg-mc-bg' : 'bg-mc-bg-secondary'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-mc-border">
        <h2 className="text-2xl font-bold text-mc-text">Office View</h2>
        <button
          onClick={() => setIsNightMode(!isNightMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isNightMode ? 'bg-tier-skippy/20 text-tier-skippy' : 'bg-mc-bg-tertiary text-mc-text'
          }`}
        >
          {isNightMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isNightMode ? 'Day Mode' : 'Night Mode'}
        </button>
      </div>

      {/* Office Grid */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {mockAgents.map((agent) => (
            <div
              key={agent.id}
              className={`relative p-4 rounded-lg border transition-all ${
                isNightMode
                  ? 'bg-mc-bg-secondary border-mc-border shadow-lg shadow-purple-900/20'
                  : 'bg-mc-bg-tertiary border-mc-border'
              }`}
            >
              {/* Avatar */}
              <div className="text-4xl text-center mb-2">{agent.emoji}</div>

              {/* Name */}
              <h3 className="font-medium text-mc-text text-center text-sm">{agent.name}</h3>

              {/* Status */}
              <div className="flex justify-center mt-2">
                <StatusBadge status={agent.status} size="sm" showLabel={false} />
              </div>

              {/* Activity */}
              <div className="mt-3 text-center">
                <span className="text-xs text-mc-text-secondary">
                  {activityEmojis[agent.activity]} {agent.activity}
                </span>
              </div>

              {/* Monitor - Show current task */}
              {agent.task && (
                <div className="mt-3 p-2 bg-mc-bg rounded text-center">
                  <span className="text-xs text-mc-accent">{agent.task}</span>
                </div>
              )}

              {/* Night mode glow effect */}
              {isNightMode && agent.status === 'active' && (
                <div className="absolute inset-0 rounded-lg bg-tier-skippy/5 pointer-events-none" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Floor */}
      <div className={`h-4 ${isNightMode ? 'bg-mc-bg-tertiary' : 'bg-mc-bg-secondary'} rounded-b-lg`} />
    </div>
  );
}
