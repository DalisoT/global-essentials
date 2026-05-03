'use client';

import { useCallback, useRef, useState } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface UseSwipeReturn {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  offsetX: number;
  isSwiping: boolean;
}

const SWIPE_THRESHOLD = 100; // pixels to trigger action

export function useSwipe(handlers: SwipeHandlers): UseSwipeReturn {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = startXRef.current;
    setIsSwiping(true);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    currentXRef.current = e.touches[0].clientX;
    const delta = currentXRef.current - startXRef.current;
    setOffsetX(delta);
  }, []);

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      const delta = currentXRef.current - startXRef.current;

      if (delta > SWIPE_THRESHOLD && handlers.onSwipeRight) {
        handlers.onSwipeRight();
      } else if (delta < -SWIPE_THRESHOLD && handlers.onSwipeLeft) {
        handlers.onSwipeLeft();
      }

      setOffsetX(0);
      setIsSwiping(false);
    },
    [handlers]
  );

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
    offsetX,
    isSwiping,
  };
}