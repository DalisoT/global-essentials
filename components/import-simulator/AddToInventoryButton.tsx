'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { CalculationResult } from '@/lib/import/calculator';

interface AddToInventoryButtonProps {
  productName: string;
  result: CalculationResult;
  className?: string;
}

export function AddToInventoryButton({ productName, result, className }: AddToInventoryButtonProps) {
  const router = useRouter();

  if (!result.costPerUnitLocal || !result.sellingPricePerUnit) return null;

  const params = new URLSearchParams({
    prefill: 'true',
    name: encodeURIComponent(productName || 'New Product'),
    cost_price: result.costPerUnitLocal.toFixed(2),
    selling_price: result.sellingPricePerUnit.toFixed(2),
  });

  const handleAddToInventory = () => {
    router.push(`/inventory?${params.toString()}`);
  };

  return (
    <button
      onClick={handleAddToInventory}
      className={cn(
        'w-full h-14 rounded-xl font-bold text-sm uppercase tracking-wide transition-all',
        'bg-tactical-neon text-tactical-black hover:bg-tactical-neon/90',
        className
      )}
    >
      + Add to Inventory
    </button>
  );
}