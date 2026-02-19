'use client';

import { Mail, Play, Eye, ExternalLink, MessageCircle, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useSSEEvents } from '@/lib/hooks/useSSE';

interface TeamMember {
  id: string;
  name: string;
  tier: 'skippy' | 'manager' | 'subagent';
  role: string;
  manager_id?: string;
  status: 'active' | 'idle' | 'on-demand' | 'offline';
  discord_id?: string;
  avatar_emoji: string;
}

const tierColors: Record<string, { border: string; bg: string }> = {
  skippy: { border: 'border-tier-skippy', bg: 'bg-tier-skippy/10' },
  manager: { border: 'border-tier-manager', bg: 'bg-tier-manager/10' },
  subagent: { border: 'border-tier-subagent', bg: 'bg-tier-subagent/10' },
};

const DISCORD_GUILD_ID = '1473396197992431679';

export default function TeamOrgChart() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/team');
      const data = await res.json();
      if (data.success) {
        setMembers(data.members);
      }
    } catch (error) {
      console.error('Failed to fetch team:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Real-time updates via SSE
  useSSEEvents('team_updated', fetchTeam);

  const updateStatus = async (id: string, status: TeamMember['status']) => {
    try {
      await fetch(`/api/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      fetchTeam();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const getDiscordLink = (discordId?: string) => {
    if (!discordId) return '#';
    return `https://discord.com/channels/${DISCORD_GUILD_ID}/${discordId}`;
  };

  const skippy = members.find((m) => m.tier === 'skippy');
  const managers = members.filter((m) => m.tier === 'manager');
  const subagents = members.filter((m) => m.tier === 'subagent');

  const getSubagents = (managerId: string) =>
    subagents.filter((s) => s.manager_id === managerId);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-400">Loading team...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6 px-2">Team Org Chart</h2>

      <div className="flex-1 overflow-auto">
        {/* Tier 1: Skippy */}
        {skippy && (
          <div className="flex justify-center mb-6">
            <MemberCard
              member={skippy}
              onMessage={() => window.open(getDiscordLink(skippy.discord_id), '_blank')}
              onViewTasks={() => {}}
              onSpawn={() => {}}
              compact={false}
            />
          </div>
        )}

        {/* Connector */}
        <div className="flex justify-center mb-4">
          <div className="w-px h-8 bg-slate-700" />
        </div>

        {/* Tier 2: Managers */}
        <div className="flex justify-center gap-6 mb-6">
          {managers.map((manager) => (
            <div key={manager.id} className="flex flex-col items-center">
              <MemberCard
                member={manager}
                onMessage={() => window.open(getDiscordLink(manager.discord_id), '_blank')}
                onViewTasks={() => {}}
                onSpawn={() => {}}
                compact={false}
              />

              {/* Tier 3: Subagents */}
              <div className="mt-4 space-y-2">
                {getSubagents(manager.id).map((subagent) => (
                  <MemberCard
                    key={subagent.id}
                    member={subagent}
                    onMessage={() => {}}
                    onViewTasks={() => {}}
                    onSpawn={() => {}}
                    compact
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-slate-400 px-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-active" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-idle" />
          <span>Idle</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-demand" />
          <span>On-Demand</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-status-offline" />
          <span>Offline</span>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  onMessage,
  onViewTasks,
  onSpawn,
  compact,
}: {
  member: TeamMember;
  onMessage: () => void;
  onViewTasks: () => void;
  onSpawn: () => void;
  compact: boolean;
}) {
  const colors = tierColors[member.tier];

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${colors.border} ${colors.bg} w-48`}>
        <span className="text-lg">{member.avatar_emoji}</span>
        <span className="text-sm text-white flex-1">{member.name}</span>
        <StatusBadge status={member.status} size="sm" showLabel={false} />
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border-2 ${colors.border} ${colors.bg} w-64`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{member.avatar_emoji}</span>
          <h3 className="font-bold text-white">{member.name}</h3>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded font-semibold ${
            member.tier === 'skippy'
              ? 'bg-tier-skippy text-black'
              : member.tier === 'manager'
              ? 'bg-tier-manager text-white'
              : 'bg-tier-subagent text-white'
          }`}
        >
          {member.tier.toUpperCase()}
        </span>
      </div>

      <p className="text-sm text-slate-400 mb-3">{member.role}</p>

      <div className="mb-3">
        <StatusBadge status={member.status} />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onViewTasks}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 rounded text-slate-300 hover:text-white hover:bg-slate-600 text-xs transition-colors"
        >
          <Eye className="w-3 h-3" />
          Tasks
        </button>
        <button
          onClick={onMessage}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 rounded text-slate-300 hover:text-white hover:bg-slate-600 text-xs transition-colors"
        >
          <MessageCircle className="w-3 h-3" />
          Message
        </button>
        {member.tier === 'manager' && (
          <button
            onClick={onSpawn}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600 rounded text-white hover:bg-blue-500 text-xs transition-colors"
          >
            <Play className="w-3 h-3" />
            Spawn
          </button>
        )}
      </div>
    </div>
  );
}
