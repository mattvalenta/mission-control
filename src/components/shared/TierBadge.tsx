import { cn } from '@/lib/utils';

interface TierBadgeProps {
  tier: 'skippy' | 'manager' | 'subagent';
  manager?: 'dev' | 'marketing' | 'insights';
  className?: string;
}

const tierConfig = {
  skippy: {
    color: 'bg-skippy-gold text-black',
    label: 'SKIPPY',
  },
  manager: {
    color: 'bg-dev-blue text-white',
    label: 'MANAGER',
  },
  subagent: {
    color: 'bg-slate-600 text-white',
    label: 'SUBAGENT',
  },
};

export function TierBadge({ tier, manager, className }: TierBadgeProps) {
  const config = tierConfig[tier];
  
  let label = config.label;
  if (tier === 'manager' && manager) {
    label = manager.toUpperCase() + '-MGR';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        config.color,
        className
      )}
    >
      {label}
    </span>
  );
}
