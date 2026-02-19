import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'active' | 'idle' | 'on-demand' | 'offline';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
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
  'on-demand': {
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

const sizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export function StatusBadge({ status, size = 'md', showLabel = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.emoji}</span>
      {showLabel && <span>{config.text}</span>}
    </span>
  );
}
