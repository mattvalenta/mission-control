'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { 
  LayoutDashboard, 
  FileText, 
  Calendar, 
  FolderOpen, 
  Users, 
  Building2,
  Share2
} from 'lucide-react';

const navItems = [
  { href: '/tasks', label: 'Tasks', icon: LayoutDashboard },
  { href: '/pipeline', label: 'Pipeline', icon: FileText },
  { href: '/social', label: 'Social', icon: Share2 },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/memory', label: 'Memory', icon: FolderOpen },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/office', label: 'Office', icon: Building2 },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="w-16 md:w-64 bg-mc-bg-secondary border-r border-mc-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-mc-border">
        <h1 className="text-lg font-bold text-mc-accent hidden md:block">
          Mission Control
        </h1>
        <span className="md:hidden text-xl">🚀</span>
      </div>

      {/* Nav Items */}
      <div className="flex-1 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-mc-accent/10 text-mc-accent'
                  : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-mc-border">
        <div className="hidden md:block text-xs text-mc-text-secondary">
          <p>Paramount Lead Solutions</p>
          <p className="mt-1">v1.1.0</p>
        </div>
      </div>
    </nav>
  );
}
