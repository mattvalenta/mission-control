import { create } from 'zustand';

type ViewMode = 'day' | 'week' | 'month';
type TimeMode = 'day' | 'night';

interface UIState {
  // Navigation
  activeScreen: 'tasks' | 'pipeline' | 'calendar' | 'memory' | 'team' | 'office';
  setActiveScreen: (screen: UIState['activeScreen']) => void;
  
  // Tasks Board
  taskTierFilter: 'all' | 'skippy' | 'manager' | 'subagent';
  taskManagerFilter: 'all' | 'dev' | 'marketing' | 'insights';
  taskStatusFilter: 'all' | 'backlog' | 'planning' | 'in_progress' | 'complete' | 'blocked';
  setTaskTierFilter: (tier: UIState['taskTierFilter']) => void;
  setTaskManagerFilter: (manager: UIState['taskManagerFilter']) => void;
  setTaskStatusFilter: (status: UIState['taskStatusFilter']) => void;
  
  // Calendar
  calendarView: ViewMode;
  calendarDate: Date;
  setCalendarView: (view: ViewMode) => void;
  setCalendarDate: (date: Date) => void;
  
  // Office
  officeTimeMode: TimeMode;
  toggleOfficeTimeMode: () => void;
  
  // Modals
  isTaskModalOpen: boolean;
  isPipelineModalOpen: boolean;
  selectedTaskId: string | null;
  selectedPipelineItemId: string | null;
  openTaskModal: (taskId?: string) => void;
  closeTaskModal: () => void;
  openPipelineModal: (itemId?: string) => void;
  closePipelineModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // Navigation
  activeScreen: 'tasks',
  setActiveScreen: (screen) => set({ activeScreen: screen }),
  
  // Tasks Board
  taskTierFilter: 'all',
  taskManagerFilter: 'all',
  taskStatusFilter: 'all',
  setTaskTierFilter: (tier) => set({ taskTierFilter: tier }),
  setTaskManagerFilter: (manager) => set({ taskManagerFilter: manager }),
  setTaskStatusFilter: (status) => set({ taskStatusFilter: status }),
  
  // Calendar
  calendarView: 'week',
  calendarDate: new Date(),
  setCalendarView: (view) => set({ calendarView: view }),
  setCalendarDate: (date) => set({ calendarDate: date }),
  
  // Office
  officeTimeMode: 'day',
  toggleOfficeTimeMode: () => set((state) => ({ 
    officeTimeMode: state.officeTimeMode === 'day' ? 'night' : 'day' 
  })),
  
  // Modals
  isTaskModalOpen: false,
  isPipelineModalOpen: false,
  selectedTaskId: null,
  selectedPipelineItemId: null,
  openTaskModal: (taskId) => set({ isTaskModalOpen: true, selectedTaskId: taskId || null }),
  closeTaskModal: () => set({ isTaskModalOpen: false, selectedTaskId: null }),
  openPipelineModal: (itemId) => set({ isPipelineModalOpen: true, selectedPipelineItemId: itemId || null }),
  closePipelineModal: () => set({ isPipelineModalOpen: false, selectedPipelineItemId: null }),
}));
