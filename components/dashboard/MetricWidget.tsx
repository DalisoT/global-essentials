'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pin, PinOff, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WidgetConfig } from '@/stores/dashboard-store';

interface MetricWidgetProps {
  widget: WidgetConfig;
  children: React.ReactNode;
  isEditing: boolean;
  onTogglePin: () => void;
  onToggleCollapse: () => void;
}

export function MetricWidget({
  widget,
  children,
  isEditing,
  onTogglePin,
  onToggleCollapse,
}: MetricWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'card-tactical transition-all',
        isDragging && 'opacity-50 ring-2 ring-tactical-blue z-50'
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              {...attributes}
              {...listeners}
              className="p-1 rounded hover:bg-white/10 text-white/40 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {widget.isPinned && (
              <Pin className="w-4 h-4 text-tactical-blue" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onTogglePin}
            className="p-1 rounded hover:bg-white/10 text-white/40"
            title={widget.isPinned ? 'Unpin' : 'Pin'}
          >
            {widget.isPinned ? (
              <PinOff className="w-4 h-4" />
            ) : (
              <Pin className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-white/10 text-white/40"
          >
            {widget.isCollapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {!widget.isCollapsed && children}
    </div>
  );
}