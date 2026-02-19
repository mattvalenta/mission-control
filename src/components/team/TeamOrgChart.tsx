'use client';

import { Mail, Play, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';

interface Agent {
  id: string;
  name: string;
  role: string;
  tier: 'skippy' | 'manager' | 'subagent';
  status: 'active' | 'idle' | 'on-demand' | 'offline';
  managerId?: string;
}

const mockTeam: Agent[] = [
  { id: 'skippy', name: 'Skippy', role: 'CEO Agent', tier: 'skippy', status: 'active' },
  { id: 'dev-manager', name: 'Dev Manager', role: 'CTO/Tech Lead', tier: 'manager', status: 'active' },
  { id: 'marketing-manager', name: 'Marketing Manager', role: 'Marketing Lead', tier: 'manager', status: 'active' },
  { id: 'insights-manager', name: 'Insights Manager', role: 'Analytics Lead', tier: 'manager', status: 'idle' },
  { id: 'frontend-dev', name: 'Frontend Dev', role: 'UI Developer', tier: 'subagent', status: 'active', managerId: 'dev-manager' },
  { id: 'backend-dev', name: 'Backend Dev', role: 'API Developer', tier: 'subagent', status: 'active', managerId: 'dev-manager' },
  { id: 'qa-agent', name: 'QA Agent', role: 'Testing', tier: 'subagent', status: 'on-demand', managerId: 'dev-manager' },
  { id: 'rpa-dev', name: 'RPA Developer', role: 'Automation', tier: 'subagent', status: 'active', managerId: 'dev-manager' },
  { id: 'researcher', name: 'Researcher', role: 'Content Research', tier: 'subagent', status: 'active', managerId: 'marketing-manager' },
  { id: 'copywriter', name: 'Copywriter', role: 'Content Writing', tier: 'subagent', status: 'idle', managerId: 'marketing-manager' },
  { id: 'data-analyst', name: 'Data Analyst', role: 'Analytics', tier: 'subagent', status: 'active', managerId: 'insights-manager' },
  { id: 'report-agent', name: 'Report Agent', role: 'Reporting', tier: 'subagent', status: 'on-demand', managerId: 'insights-manager' },
];

export default function TeamOrgChart() {
  const skippy = mockTeam.find((a) => a.tier === 'skippy');
  const managers = mockTeam.filter((a) => a.tier === 'manager');
  const subagents = mockTeam.filter((a) => a.tier === 'subagent');

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold text-mc-text mb-6">Team Org Chart</h2>

      <div className="flex-1 overflow-auto">
        {/* Tier 1: Skippy */}
        <div className="flex justify-center mb-8">
          <AgentCard agent={skippy!} />
        </div>

        {/* Connector Line */}
        <div className="flex justify-center mb-4">
          <div className="w-px h-8 bg-mc-border"></div>
        </div>

        {/* Tier 2: Managers */}
        <div className="flex justify-center gap-8 mb-8">
          {managers.map((manager) => (
            <div key={manager.id} className="flex flex-col items-center">
              <AgentCard agent={manager} />
              
              {/* Tier 3: Subagents */}
              <div className="mt-4 flex flex-col gap-2">
                {subagents
                  .filter((s) => s.managerId === manager.id)
                  .map((subagent) => (
                    <AgentCard key={subagent.id} agent={subagent} compact />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const tierColors = {
    skippy: 'border-tier-skippy bg-tier-skippy/10',
    manager: 'border-tier-manager bg-tier-manager/10',
    subagent: 'border-tier-subagent bg-tier-subagent/10',
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${tierColors[agent.tier]}`}>
        <StatusBadge status={agent.status} size="sm" showLabel={false} />
        <span className="text-sm text-mc-text">{agent.name}</span>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border w-56 ${tierColors[agent.tier]}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-mc-text">{agent.name}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            agent.tier === 'skippy'
              ? 'bg-tier-skippy/30 text-tier-skippy'
              : agent.tier === 'manager'
              ? 'bg-tier-manager/30 text-tier-manager'
              : 'bg-tier-subagent/30 text-tier-subagent'
          }`}
        >
          {agent.tier.toUpperCase()}
        </span>
      </div>
      <p className="text-sm text-mc-text-secondary mb-2">{agent.role}</p>
      <StatusBadge status={agent.status} />

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-mc-bg-tertiary rounded text-mc-text-secondary hover:text-mc-text">
          <Eye className="w-3 h-3" />
          Tasks
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-mc-bg-tertiary rounded text-mc-text-secondary hover:text-mc-text">
          <Mail className="w-3 h-3" />
          Message
        </button>
        {agent.tier === 'manager' && (
          <button className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-mc-bg-tertiary rounded text-mc-text-secondary hover:text-mc-text">
            <Play className="w-3 h-3" />
            Spawn
          </button>
        )}
      </div>
    </div>
  );
}
