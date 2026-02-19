import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'idle' | 'on_demand' | 'offline';
  className?: string;
}

const statusConfig = {
  active: {
    color: 'bg-status-active',
    text: 'Active',
    emoji: '🟢',
  },
  idle: {
    color: 'bg-status-idle',
    text: 'Idle',
    emoji: '🟡',
  },
  on_demand: {
    color: 'bg-status-on-demand',
    text: 'On-Demand',
    emoji: '⚪',
  },
  offline: {
    color: 'bg-status-offline',
    text: 'Offline',
    emoji: '🔴',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
        config.color,
        className
      )}
    >
      <span>{config.emoji}</span>
      <span>{config.text}</span>
    </span>
  );
}
