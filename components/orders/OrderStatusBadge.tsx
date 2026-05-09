'use client';

import { cn } from '@/lib/utils';
import type { Order } from '@/lib/supabase-types';

interface OrderStatusBadgeProps {
  status: Order['status'];
  size?: 'sm' | 'md';
}

const statusConfig: Record<Order['status'], { label: string; class: string }> = {
  pending: { label: 'Pending', class: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  confirmed: { label: 'Confirmed', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  processing: { label: 'Processing', class: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  shipped: { label: 'Shipped', class: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  delivered: { label: 'Delivered', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelled: { label: 'Cancelled', class: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-bold uppercase tracking-wide border',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        config.class
      )}
    >
      {config.label}
    </span>
  );
}