import { create } from 'zustand';

type ViewMode = 'day' | 'week' | 'month';
type ThemeMode = 'day' | 'night';

interface UIState {
  // Navigation
  activeScreen: string;
  setActiveScreen: (screen: string) => void;

  // Tasks
  taskFilter: {
    tier: 'all' | 'skippy' | 'manager' | 'subagent';
    manager: 'all' | 'dev' | 'marketing' | 'insights';
    status: 'all' | 'backlog' | 'planning' | 'in_progress' | 'complete' | 'blocked';
  };
  setTaskFilter: (filter: Partial<UIState['taskFilter']>) => void;

  // Calendar
  calendarView: ViewMode;
  setCalendarView: (view: ViewMode) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  // Office
  officeTheme: ThemeMode;
  setOfficeTheme: (theme: ThemeMode) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;

  // Memory
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // UI State
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  modalOpen: string | null;
  setModalOpen: (modal: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Navigation
  activeScreen: 'tasks',
  setActiveScreen: (screen) => set({ activeScreen: screen }),

  // Tasks
  taskFilter: {
    tier: 'all',
    manager: 'all',
    status: 'all',
  },
  setTaskFilter: (filter) =>
    set((state) => ({
      taskFilter: { ...state.taskFilter, ...filter },
    })),

  // Calendar
  calendarView: 'day',
  setCalendarView: (view) => set({ calendarView: view }),
  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  // Office
  officeTheme: 'day',
  setOfficeTheme: (theme) => set({ officeTheme: theme }),
  soundEnabled: false,
  setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),

  // Memory
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // UI State
  sidebarCollapsed: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  modalOpen: null,
  setModalOpen: (modal) => set({ modalOpen: modal }),
}));
