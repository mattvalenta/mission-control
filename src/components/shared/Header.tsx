'use client';

import { Bell, Search, Settings } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="h-16 bg-mc-bg-secondary border-b border-mc-border px-4 flex items-center justify-between">
      {/* Title */}
      <h1 className="text-xl font-semibold text-mc-text">
        {title || 'Mission Control'}
      </h1>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 bg-mc-bg-tertiary rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-mc-text-secondary" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-mc-text placeholder-mc-text-secondary w-48"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-mc-text-secondary hover:text-mc-text transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-mc-accent-red rounded-full" />
        </button>

        {/* Settings */}
        <button className="p-2 text-mc-text-secondary hover:text-mc-text transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-mc-accent flex items-center justify-center text-sm font-medium text-white">
            DM
          </div>
          <span className="hidden md:inline text-sm text-mc-text">Dev Manager</span>
        </div>
      </div>
    </header>
  );
}
