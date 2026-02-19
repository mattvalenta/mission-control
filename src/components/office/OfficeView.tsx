'use client';

import { Moon, Sun, Coffee, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
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

const activityEmojis: Record<string, string> = {
  typing: '⌨️',
  working: '💼',
  coding: '💻',
  searching: '🔍',
  editing: '✏️',
  idle: '💤',
  sleeping: '😴',
  offline: '○',
};

const activityAnimations: Record<string, string> = {
  typing: 'animate-pulse',
  working: '',
  coding: 'animate-pulse',
  searching: 'animate-bounce',
  editing: '',
  idle: 'animate-pulse',
  sleeping: 'animate-pulse',
  offline: '',
};

export default function OfficeView() {
  const [isNightMode, setIsNightMode] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([
    { id: 'skippy', name: 'Skippy', emoji: '🍺', role: 'CEO Agent', status: 'active', activity: 'typing', task: 'Mission Control v2' },
    { id: 'dev-manager', name: 'Dev Manager', emoji: '💻', role: 'CTO/Tech Lead', status: 'active', activity: 'coding', task: 'API Development' },
    { id: 'marketing-manager', name: 'Marketing Mgr', emoji: '📱', role: 'Marketing Lead', status: 'active', activity: 'working', task: 'Campaign Strategy' },
    { id: 'insights-manager', name: 'Insights Mgr', emoji: '📊', role: 'Analytics Lead', status: 'idle', activity: 'idle' },
    { id: 'frontend-dev', name: 'Frontend Dev', emoji: '🎨', role: 'UI Developer', status: 'active', activity: 'coding', task: 'Dashboard UI' },
    { id: 'backend-dev', name: 'Backend Dev', emoji: '📝', role: 'API Developer', status: 'active', activity: 'working', task: 'Endpoints' },
    { id: 'qa-agent', name: 'QA Agent', emoji: '🔍', role: 'Testing', status: 'on-demand', activity: 'sleeping' },
    { id: 'rpa-dev', name: 'RPA Developer', emoji: '🤖', role: 'Automation', status: 'active', activity: 'working', task: 'Scraper v2' },
    { id: 'researcher', name: 'Researcher', emoji: '🔬', role: 'Content Research', status: 'active', activity: 'searching' },
    { id: 'copywriter', name: 'Copywriter', emoji: '✍️', role: 'Content Writing', status: 'idle', activity: 'editing' },
    { id: 'data-analyst', name: 'Data Analyst', emoji: '📈', role: 'Analytics', status: 'active', activity: 'working', task: 'Monthly Report' },
    { id: 'voice-agent', name: 'Voice Agent', emoji: '📞', role: 'Call Handling', status: 'active', activity: 'working', task: 'Inbound Calls' },
  ]);

  // Simulate activity changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAgents((prev) =>
        prev.map((agent) => {
          if (agent.status === 'active' && Math.random() > 0.8) {
            const activities = ['typing', 'working', 'coding', 'searching', 'editing'];
            return { ...agent, activity: activities[Math.floor(Math.random() * activities.length)] };
          }
          return agent;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const activeCount = agents.filter((a) => a.status === 'active').length;
  const onDemandCount = agents.filter((a) => a.status === 'on-demand').length;

  return (
    <div className={`h-full flex flex-col rounded-lg transition-colors duration-500 ${isNightMode ? 'bg-slate-900' : 'bg-slate-800/50'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-white">Office View</h2>
          <span className="text-sm text-slate-400">
            {isNightMode ? '🌙 Night Mode' : '☀️ Day Mode'}
          </span>
        </div>
        <button
          onClick={() => setIsNightMode(!isNightMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            isNightMode ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {isNightMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isNightMode ? 'Day Mode' : 'Night Mode'}
        </button>
      </div>

      {/* Office Floor */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Welcome Sign */}
        <div className={`text-center py-2 mb-6 rounded-lg ${isNightMode ? 'bg-slate-800' : 'bg-slate-700/50'}`}>
          <span className="text-slate-300 text-lg">🏢 MISSION CONTROL</span>
          <span className={`ml-4 text-sm ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {activeCount} active • {onDemandCount} on-demand
          </span>
        </div>

        {/* Desk Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`relative p-4 rounded-lg border-2 transition-all duration-300 ${
                isNightMode
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-slate-700/50 border-slate-600'
              } ${
                agent.status === 'active' && isNightMode ? 'shadow-lg shadow-blue-500/10' : ''
              } hover:border-slate-500 cursor-pointer`}
            >
              {/* Status Indicator */}
              <div className="absolute top-2 right-2">
                <StatusBadge status={agent.status} size="sm" showLabel={false} />
              </div>

              {/* Avatar */}
              <div className={`text-4xl text-center mb-2 ${activityAnimations[agent.activity]}`}>
                {agent.emoji}
              </div>

              {/* Name */}
              <h3 className="font-medium text-white text-center text-sm truncate">{agent.name}</h3>

              {/* Activity */}
              <div className="text-center mt-1">
                <span className="text-xs text-slate-400">
                  {activityEmojis[agent.activity]} {agent.activity}
                </span>
              </div>

              {/* Current Task (Monitor) */}
              {agent.task && (
                <div className={`mt-3 p-2 rounded text-center ${isNightMode ? 'bg-slate-700' : 'bg-slate-600/50'}`}>
                  <span className="text-xs text-blue-400 truncate block">{agent.task}</span>
                </div>
              )}

              {/* Night Mode Glow */}
              {isNightMode && agent.status === 'active' && (
                <div className="absolute inset-0 rounded-lg bg-blue-500/5 pointer-events-none" />
              )}
            </div>
          ))}
        </div>

        {/* Lounge Area */}
        <div className={`mt-6 p-4 rounded-lg text-center ${isNightMode ? 'bg-slate-800' : 'bg-slate-700/50'}`}>
          <span className="text-slate-400">🛋️</span>
          <span className={`ml-2 ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`}>
            Matt&apos;s Chair — Empty
          </span>
        </div>
      </div>

      {/* Floor */}
      <div className={`h-2 rounded-b-lg ${isNightMode ? 'bg-slate-950' : 'bg-slate-800'}`} />

      {/* Coffee Counter */}
      <div className={`px-4 py-2 flex items-center justify-center gap-4 text-xs ${isNightMode ? 'bg-slate-900 text-slate-500' : 'text-slate-400'}`}>
        <span className="flex items-center gap-1">
          <Coffee className="w-3 h-3" />
          12 cups today
        </span>
        <span className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          {activeCount} agents online
        </span>
      </div>
    </div>
  );
}
