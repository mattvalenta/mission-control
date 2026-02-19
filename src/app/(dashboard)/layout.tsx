import { Metadata } from 'next';
import Link from 'next/link';
import { LayoutDashboard, CheckSquare, FileText, Calendar, FolderOpen, Users, Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Mission Control',
  description: 'Multi-Agent Orchestration Dashboard',
};

const navItems = [
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/pipeline', label: 'Pipeline', icon: FileText },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/memory', label: 'Memory', icon: FolderOpen },
  { href: '/team', label: 'Team', icon: Users },
  { href: '/office', label: 'Office', icon: Building2 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-700 bg-slate-800">
        <div className="flex h-16 items-center border-b border-slate-700 px-6">
          <LayoutDashboard className="h-6 w-6 text-amber-400" />
          <span className="ml-2 text-lg font-semibold text-white">Mission Control</span>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
