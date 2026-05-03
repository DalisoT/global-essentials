'use client';

import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
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

interface VariantMatrixProps {
  variants: Variant[];
  basePrice: number;
  onChange: (variants: Variant[]) => void;
}

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Gray', 'Navy'];

export function VariantMatrix({ variants, basePrice, onChange }: VariantMatrixProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  // Build a map of existing variants
  const variantMap = new Map<string, Variant>();
  for (const v of variants) {
    const key = `${v.size || ''}-${v.color || ''}`;
    variantMap.set(key, v);
  }

  const handleCellClick = (size: string | null, color: string | null) => {
    const key = `${size || ''}-${color || ''}`;
    const existing = variantMap.get(key);

    if (existing) {
      setEditingVariant(existing);
    } else {
      setSelectedSize(size);
      setSelectedColor(color);
      setEditingVariant({
        size: size || undefined,
        color: color || undefined,
        sku: '',
        barcode: '',
        stock_level: 0,
        price_modifier: 0,
      });
    }
  };

  const handleSaveVariant = (variant: Variant) => {
    const key = `${variant.size || ''}-${variant.color || ''}`;
    const existingIndex = variants.findIndex(
      (v) => `${v.size || ''}-${v.color || ''}` === key
    );

    if (existingIndex >= 0) {
      const newVariants = [...variants];
      newVariants[existingIndex] = variant;
      onChange(newVariants);
    } else {
      onChange([...variants, variant]);
    }

    setEditingVariant(null);
    setSelectedSize(null);
    setSelectedColor(null);
  };

  const handleDeleteVariant = (variant: Variant) => {
    onChange(variants.filter((v) => v !== variant));
    setEditingVariant(null);
  };

  return (
    <div className="space-y-4">
      {/* Matrix Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-white/60 p-2">Size / Color</th>
              {COLORS.map((color) => (
                <th key={color} className="text-center text-white/60 p-2 min-w-[80px]">
                  {color}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => (
              <tr key={size}>
                <td className="text-white font-semibold p-2">{size}</td>
                {COLORS.map((color) => {
                  const key = `${size}-${color}`;
                  const variant = variantMap.get(key);
                  const hasStock = variant && variant.stock_level > 0;

                  return (
                    <td key={color} className="p-1">
                      <button
                        onClick={() => handleCellClick(size, color)}
                        className={cn(
                          'w-full h-10 rounded-lg border transition-all',
                          variant
                            ? hasStock
                              ? 'bg-tactical-neon/20 border-tactical-neon text-tactical-neon'
                              : 'bg-tactical-red/20 border-tactical-red/50 text-tactical-red/50'
                            : 'bg-white/5 border-white/10 hover:border-white/30'
                        )}
                      >
                        {variant ? (
                          <div className="flex flex-col items-center justify-center">
                            <span className="text-xs font-bold">{variant.stock_level}</span>
                            {variant.price_modifier !== 0 && (
                              <span className="text-[8px]">
                                {variant.price_modifier > 0 ? '+' : ''}{variant.price_modifier}
                              </span>
                            )}
                          </div>
                        ) : (
                          <Plus className="w-4 h-4 mx-auto opacity-30" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-white/40">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-tactical-neon/20 border border-tactical-neon" />
          <span>In Stock</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-tactical-red/20 border border-tactical-red/50" />
          <span>Out of Stock</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-white/5 border border-white/10" />
          <span>Not Set</span>
        </div>
      </div>

      {/* Edit/Create Modal */}
      {editingVariant && (
        <VariantEditModal
          variant={editingVariant}
          basePrice={basePrice}
          onSave={handleSaveVariant}
          onDelete={editingVariant.id ? () => handleDeleteVariant(editingVariant) : undefined}
          onClose={() => {
            setEditingVariant(null);
            setSelectedSize(null);
            setSelectedColor(null);
          }}
        />
      )}
    </div>
  );
}

interface VariantEditModalProps {
  variant: Variant;
  basePrice: number;
  onSave: (variant: Variant) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function VariantEditModal({ variant, basePrice, onSave, onDelete, onClose }: VariantEditModalProps) {
  const [form, setForm] = useState({
    sku: variant.sku,
    barcode: variant.barcode || '',
    stock_level: variant.stock_level,
    price_modifier: variant.price_modifier,
  });

  const finalPrice = basePrice + form.price_modifier;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tactical-slate rounded-2xl w-full max-w-md border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-bold text-white">
            {variant.size && variant.color ? `${variant.size} / ${variant.color}` : 'Edit Variant'}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white"
              placeholder="SKU-001"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Barcode (optional)</label>
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white"
              placeholder="1234567890123"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Stock Level</label>
            <input
              type="number"
              value={form.stock_level}
              onChange={(e) => setForm({ ...form, stock_level: parseInt(e.target.value) || 0 })}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white"
              min="0"
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Price Modifier (K)</label>
            <input
              type="number"
              value={form.price_modifier}
              onChange={(e) => setForm({ ...form, price_modifier: parseFloat(e.target.value) || 0 })}
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white"
              step="0.01"
            />
            <p className="text-xs text-white/40 mt-1">
              Base: K{basePrice.toFixed(2)} → Final: K{finalPrice.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex gap-3 p-4 border-t border-white/10">
          {onDelete && (
            <button
              onClick={onDelete}
              className="btn-tactical-danger flex-1"
            >
              Delete
            </button>
          )}
          <button onClick={onClose} className="flex-1 btn-tactical-secondary">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...variant, ...form })}
            className="flex-1 btn-tactical"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}