'use client';

import { useSwipe } from '@/hooks/useSwipe';
import { cn } from '@/lib/utils';
import { CheckCircle, Eye } from 'lucide-react';

interface QuickPaySwipeProps {
  children: React.ReactNode;
  onMarkPaid: () => void;
  onViewDetails: () => void;
  className?: string;
}

export function QuickPaySwipe({ children, onMarkPaid, onViewDetails, className }: QuickPaySwipeProps) {
  const { handlers, offsetX, isSwiping } = useSwipe({
    onSwipeRight: onMarkPaid,
    onSwipeLeft: onViewDetails,
  });

  const showRightAction = offsetX > 50;
  const showLeftAction = offsetX < -50;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Left action - View Details */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-20 bg-tactical-blue/20 flex items-center justify-center transition-opacity',
          showLeftAction ? 'opacity-100' : 'opacity-0'
        )}
      >
        <Eye className="w-6 h-6 text-tactical-blue" />
      </div>

      {/* Right action - Mark Paid */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 w-20 bg-tactical-neon/20 flex items-center justify-center transition-opacity',
          showRightAction ? 'opacity-100' : 'opacity-0'
        )}
      >
        <CheckCircle className="w-6 h-6 text-tactical-neon" />
      </div>

      {/* Main content */}
      <div
        {...handlers}
        className={cn(
          'relative transition-transform',
          isSwiping && 'transition-none',
          className
        )}
        style={{ transform: `translateX(${offsetX}px)` }}
      >
        {children}
      </div>

      {/* Hint overlay when not swiping */}
      {!isSwiping && (
        <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black/40 to-transparent pointer-events-none" />
      )}
    </div>
  );
}