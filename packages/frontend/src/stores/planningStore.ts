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
  goToDate: (date: Date | string) => void;
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

    // Navegación por periodos calendario reales (evita el bug de meses
    // de 31 días / trimestres / años bisiestos donde la vista no avanzaba)
    const n = direction === 'prev' ? -1 : 1;
    const newDate = new Date(startDate);
    switch (timeScale) {
      case 'day':
        newDate.setDate(newDate.getDate() + n);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + 7 * n);
        break;
      case 'fortnight':
        newDate.setDate(newDate.getDate() + 14 * n);
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + n);
        break;
      case 'quarter':
        newDate.setMonth(newDate.getMonth() + 3 * n);
        break;
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + n);
        break;
    }

    const { start } = getDateRange(newDate, timeScale);
    set({ startDate: start });
  },

  goToDate: (date) => {
    const { timeScale } = get();
    const { start } = getDateRange(new Date(date), timeScale);
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
