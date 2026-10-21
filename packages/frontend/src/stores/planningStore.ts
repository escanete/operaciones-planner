import { create } from 'zustand';
import type { TimeScale, ViewMode, PlanningFilters } from '@operaciones-planner/shared';
import { getDateRange, ROLE_LEVELS } from '@operaciones-planner/shared';

interface PlanningState {
  // Vista
  viewMode: ViewMode;
  timeScale: TimeScale;
  startDate: Date;
  
  // Filtros
  filters: PlanningFilters;
  
  // Jerarquía de roles (decisión f): nivel -> etiqueta
  roleHierarchy: Record<number, string>;
  
  // UI State
  selectedAssignmentId: string | null;
  sidebarOpen: boolean;
  bottomPanel: 'detail' | 'conflicts' | 'logistics' | null;
  assignmentModalOpen: boolean;
  
  // Drag & Drop
  draggingAssignmentId: string | null;
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setTimeScale: (scale: TimeScale) => void;
  navigateDate: (direction: 'prev' | 'next' | 'today') => void;
  setFilters: (filters: Partial<PlanningFilters>) => void;
  clearFilters: () => void;
  setRoleHierarchy: (hierarchy: Record<number, string>) => void;
  selectAssignment: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setBottomPanel: (panel: 'detail' | 'conflicts' | 'logistics' | null) => void;
  setDraggingAssignment: (id: string | null) => void;
  setAssignmentModalOpen: (open: boolean) => void;
  getDateRange: () => { start: Date; end: Date };
}

export const usePlanningStore = create<PlanningState>((set, get) => ({
  viewMode: 'grid',
  timeScale: 'week',
  startDate: new Date(),
  filters: {},
  roleHierarchy: { ...ROLE_LEVELS },
  selectedAssignmentId: null,
  sidebarOpen: true,
  bottomPanel: null,
  draggingAssignmentId: null,
  assignmentModalOpen: false,

  setViewMode: (viewMode) => set({ viewMode }),
  
  setTimeScale: (timeScale) => {
    const { startDate } = get();
    const { start } = getDateRange(startDate, timeScale);
    set({ timeScale, startDate: start });
  },
  
  navigateDate: (direction) => {
    const { startDate, timeScale } = get();
    
    if (direction === 'today') {
      const today = new Date();
      const { start } = getDateRange(today, timeScale);
      set({ startDate: start });
      return;
    }

    const days = {
      day: 1,
      week: 7,
      fortnight: 14,
      month: 30,
      quarter: 90,
      year: 365,
    }[timeScale];

    const newDate = new Date(startDate);
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - days);
    } else {
      newDate.setDate(newDate.getDate() + days);
    }

    const { start } = getDateRange(newDate, timeScale);
    set({ startDate: start });
  },
  
  setFilters: (newFilters) => set((state) => {
    // Si el objeto está vacío, limpiar todos los filtros
    const isEmpty = Object.keys(newFilters).length === 0;
    return { filters: isEmpty ? {} : { ...state.filters, ...newFilters } };
  }),
  clearFilters: () => set({ filters: {} }),
  setRoleHierarchy: (roleHierarchy) => set({ roleHierarchy }),
  selectAssignment: (selectedAssignmentId) => set({ selectedAssignmentId }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setBottomPanel: (bottomPanel) => set({ bottomPanel }),
  setDraggingAssignment: (draggingAssignmentId) => set({ draggingAssignmentId }),
  setAssignmentModalOpen: (assignmentModalOpen) => set({ assignmentModalOpen }),
  
  getDateRange: () => {
    const { startDate, timeScale } = get();
    return getDateRange(startDate, timeScale);
  },
}));
