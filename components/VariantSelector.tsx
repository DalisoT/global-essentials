'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Variant {
  id?: string;
  size?: string;
  color?: string;
  sku: string;
  barcode?: string;
  stock_level: number;
  price_modifier: number;
}

interface VariantSelectorProps {
  variants: Variant[];
  basePrice: number;
  selectedVariant: Variant | null;
  onSelect: (variant: Variant) => void;
}

export function VariantSelector({ variants, basePrice, selectedVariant, onSelect }: VariantSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get unique sizes and colors
  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[];
  const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[];

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Filter variants based on selections
  const filteredVariants = variants.filter((v) => {
    if (selectedSize && v.size !== selectedSize) return false;
    if (selectedColor && v.color !== selectedColor) return false;
    return true;
  });

  const handleSelect = (variant: Variant) => {
    onSelect(variant);
    setIsOpen(false);
  };

  const finalPrice = selectedVariant
    ? basePrice + selectedVariant.price_modifier
    : basePrice;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full h-14 px-4 bg-white/5 border border-white/10 rounded-xl text-left flex items-center justify-between',
          'hover:border-tactical-blue transition-colors',
          isOpen && 'border-tactical-blue'
        )}
      >
        <div>
          {selectedVariant ? (
            <span className="font-semibold text-white">
              {selectedVariant.size && selectedVariant.color
                ? `${selectedVariant.size} / ${selectedVariant.color}`
                : selectedVariant.size || selectedVariant.color || 'Variant'}
            </span>
          ) : (
            <span className="text-white/40">Select variant (optional)</span>
          )}
          <span className="ml-2 text-sm text-tactical-neon font-bold">
            K{finalPrice.toFixed(2)}
          </span>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-white/40 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-tactical-slate border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/10 space-y-2">
              {sizes.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-white/40 py-1">Size:</span>
                  {sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(selectedSize === size ? null : size)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                        selectedSize === size
                          ? 'bg-tactical-blue text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
              {colors.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <span className="text-xs text-white/40 py-1">Color:</span>
                  {colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(selectedColor === color ? null : color)}
                      className={cn(
                        'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                        selectedColor === color
                          ? 'bg-tactical-blue text-white'
                          : 'bg-white/10 text-white/60 hover:bg-white/20'
                      )}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {filteredVariants.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-sm">
                  No variants match your selection
                </div>
              ) : (
                filteredVariants.map((variant) => {
                  const variantPrice = basePrice + variant.price_modifier;
                  const isOutOfStock = variant.stock_level <= 0;

                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && handleSelect(variant)}
                      disabled={isOutOfStock}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0',
                        isOutOfStock && 'opacity-50'
                      )}
                    >
                      <div className="text-left">
                        <p className="font-semibold text-white">
                          {variant.size && variant.color
                            ? `${variant.size} / ${variant.color}`
                            : variant.size || variant.color || 'Variant'}
                        </p>
                        {variant.sku && (
                          <p className="text-xs text-white/40">{variant.sku}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-tactical-neon">
                          K{variantPrice.toFixed(2)}
                        </p>
                        <p className={cn('text-xs', isOutOfStock ? 'text-tactical-red' : 'text-white/40')}>
                          {isOutOfStock ? 'Out of stock' : `${variant.stock_level} available`}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}