'use client';

import { cn } from '@/lib/utils';
import type { Category } from '@/lib/supabase-types';

interface CategoryFilterProps {
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          'px-4 py-2 rounded-full text-sm font-semibold transition-all',
          selectedCategory === null
            ? 'bg-tactical-neon text-black'
            : 'bg-white/10 text-white/60 hover:bg-white/20'
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelectCategory(cat.id)}
          className={cn(
            'px-4 py-2 rounded-full text-sm font-semibold transition-all capitalize',
            selectedCategory === cat.id
              ? 'bg-tactical-neon text-black'
              : 'bg-white/10 text-white/60 hover:bg-white/20'
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}