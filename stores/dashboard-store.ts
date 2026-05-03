import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetType =
  | 'ground-truth'
  | 'in-pipeline'
  | 'low-stock'
  | 'recent-sales'
  | 'upcoming-dues'
  | 'cash-flow'
  | 'reorder-alerts';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  isPinned: boolean;
  isCollapsed: boolean;
  order: number;
}

interface DashboardStore {
  widgets: WidgetConfig[];
  isEditing: boolean;
  setWidgets: (widgets: WidgetConfig[]) => void;
  togglePin: (id: string) => void;
  toggleCollapse: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  setEditing: (editing: boolean) => void;
  resetToDefault: () => void;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'ground-truth', type: 'ground-truth', isPinned: true, isCollapsed: false, order: 0 },
  { id: 'in-pipeline', type: 'in-pipeline', isPinned: true, isCollapsed: false, order: 1 },
  { id: 'low-stock', type: 'low-stock', isPinned: true, isCollapsed: false, order: 2 },
  { id: 'recent-sales', type: 'recent-sales', isPinned: true, isCollapsed: false, order: 3 },
  { id: 'upcoming-dues', type: 'upcoming-dues', isPinned: false, isCollapsed: false, order: 4 },
  { id: 'cash-flow', type: 'cash-flow', isPinned: false, isCollapsed: false, order: 5 },
  { id: 'reorder-alerts', type: 'reorder-alerts', isPinned: false, isCollapsed: false, order: 6 },
];

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      isEditing: false,
      setWidgets: (widgets) => set({ widgets }),
      togglePin: (id) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, isPinned: !w.isPinned } : w
          ),
        })),
      toggleCollapse: (id) =>
        set((state) => ({
          widgets: state.widgets.map((w) =>
            w.id === id ? { ...w, isCollapsed: !w.isCollapsed } : w
          ),
        })),
      reorder: (fromIndex, toIndex) =>
        set((state) => {
          const newWidgets = [...state.widgets];
          const [moved] = newWidgets.splice(fromIndex, 1);
          newWidgets.splice(toIndex, 0, moved);
          return {
            widgets: newWidgets.map((w, i) => ({ ...w, order: i })),
          };
        }),
      setEditing: (isEditing) => set({ isEditing }),
      resetToDefault: () => set({ widgets: DEFAULT_WIDGETS, isEditing: false }),
    }),
    {
      name: 'ge-dashboard',
    }
  )
);