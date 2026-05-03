'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { useDashboardStore } from '@/stores/dashboard-store';
import { MetricWidget } from './MetricWidget';
import { useDashboardData } from '@/hooks/useDashboardData';

export function WidgetGrid() {
  const {
    widgets,
    isEditing,
    togglePin,
    toggleCollapse,
    reorder,
    setEditing,
  } = useDashboardStore();

  const { data } = useDashboardData();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id);
      const newIndex = widgets.findIndex((w) => w.id === over.id);
      reorder(oldIndex, newIndex);
    }
  };

  const pinnedWidgets = widgets.filter((w) => w.isPinned).sort((a, b) => a.order - b.order);
  const unpinnedWidgets = widgets.filter((w) => !w.isPinned).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6">
      {/* Edit Mode Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">
          Dashboard Widgets
        </h2>
        <button
          onClick={() => setEditing(!isEditing)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            isEditing
              ? 'bg-tactical-blue text-white'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          }`}
        >
          {isEditing ? 'Done Editing' : 'Edit Dashboard'}
        </button>
      </div>

      {/* Pinned Widgets */}
      {pinnedWidgets.length > 0 && (
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Pinned</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pinnedWidgets.map((w) => w.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 gap-4">
                {pinnedWidgets.map((widget) => (
                  <MetricWidget
                    key={widget.id}
                    widget={widget}
                    isEditing={isEditing}
                    onTogglePin={() => togglePin(widget.id)}
                    onToggleCollapse={() => toggleCollapse(widget.id)}
                  >
                    {widget.type === 'ground-truth' && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                          Ground Truth
                        </p>
                        <p className="text-2xl font-black text-tactical-neon">
                          K{(data?.groundTruth || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Paid - Expenses</p>
                      </div>
                    )}
                    {widget.type === 'in-pipeline' && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                          In Pipeline
                        </p>
                        <p className="text-2xl font-black text-tactical-orange">
                          K{(data?.inPipeline || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Unpaid installments</p>
                      </div>
                    )}
                    {widget.type === 'low-stock' && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                          Low Stock
                        </p>
                        <p className="text-2xl font-black text-tactical-red">
                          {data?.lowStockProducts?.length || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Products below 5</p>
                      </div>
                    )}
                    {widget.type === 'recent-sales' && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">
                          Recent Sales
                        </p>
                        <p className="text-2xl font-black text-tactical-blue">
                          {data?.recentSales?.length || 0}
                        </p>
                        <p className="text-xs text-white/40 mt-1">Last 5 transactions</p>
                      </div>
                    )}
                  </MetricWidget>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Unpinned Widgets */}
      {unpinnedWidgets.length > 0 && (
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Available</p>
          <div className="grid grid-cols-2 gap-4">
            {unpinnedWidgets.map((widget) => (
              <MetricWidget
                key={widget.id}
                widget={widget}
                isEditing={isEditing}
                onTogglePin={() => togglePin(widget.id)}
                onToggleCollapse={() => toggleCollapse(widget.id)}
              >
                <div className="text-center py-4 text-white/40">
                  <p className="text-sm font-semibold">{widget.type.replace('-', ' ')}</p>
                  <p className="text-xs mt-1">Click pin to add to dashboard</p>
                </div>
              </MetricWidget>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}