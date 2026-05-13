'use client';

import { useEffect } from 'react';
import { useRecentlyViewedStore } from '@/lib/stores/recently-viewed-store';

interface TrackViewProps {
  productId: string;
}

export function TrackView({ productId }: TrackViewProps) {
  useEffect(() => {
    useRecentlyViewedStore.getState().addProduct(productId);
  }, [productId]);

  return null;
}