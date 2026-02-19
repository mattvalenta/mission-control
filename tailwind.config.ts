import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Agent Colors (from spec Appendix B)
        'skippy-gold': '#FFD700',
        'dev-blue': '#3B82F6',
        'marketing-green': '#10B981',
        'insights-purple': '#8B5CF6',
        
        // Status Colors (from spec Appendix B)
        'status-active': '#22C55E',
        'status-idle': '#F59E0B',
        'status-on-demand': '#6B7280',
        'status-offline': '#EF4444',
        
        // Background Colors (from spec Appendix B)
        'bg-primary': '#0F172A',
        'bg-secondary': '#1E293B',
        'bg-tertiary': '#334155',
        
        // Text Colors (from spec Appendix B)
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        
        // Legacy compatibility
        'mc-bg': '#0d1117',
        'mc-bg-secondary': '#161b22',
        'mc-bg-tertiary': '#21262d',
        'mc-border': '#30363d',
        'mc-text': '#c9d1d9',
        'mc-text-secondary': '#8b949e',
        'mc-accent': '#58a6ff',
        'mc-accent-green': '#3fb950',
        'mc-accent-yellow': '#d29922',
        'mc-accent-red': '#f85149',
        'mc-accent-purple': '#a371f7',
        'mc-accent-pink': '#db61a2',
        'mc-accent-cyan': '#39d353',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
