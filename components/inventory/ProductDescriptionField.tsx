'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  generateProductDescription,
  type ProductDescriptionSuggestion,
} from '@/lib/actions/catalog';

/**
 * ProductDescriptionField (Phase 8 / 8.1).
 *
 * A focused field for the inventory edit modal that lets the user:
 *   1. Manually type a description (the textarea is the source of
 *      truth once they've saved once).
 *   2. Click "Generate with AI" — calls generateProductDescription
 *      with the current product context (name, category, prices,
 *      stock) and shows a preview card with the suggested
 *      description, highlights, and category_label.
 *   3. Edit the suggestion in the textarea, then close the modal
 *      to save (handled by the parent form).
 *
 * The user must explicitly accept the AI suggestion into the
 * textarea — we never write to the DB without their click.
 *
 * Why a separate component (not inline state): the inventory
 * modal is already heavy; this isolates the AI flow and the
 * preview UI from the rest of the form.
 */

interface ProductDescriptionFieldProps {
  productId?: string;
  name: string;
  categoryName?: string | null;
  sellingPrice?: number | null;
  costPrice?: number | null;
  stockLevel?: number | null;
  description: string;
  onChange: (next: string) => void;
}

type State = 'idle' | 'loading' | 'preview' | 'error';

export function ProductDescriptionField({
  productId,
  name,
  categoryName,
  sellingPrice,
  costPrice,
  stockLevel,
  description,
  onChange,
}: ProductDescriptionFieldProps) {
  const [state, setState] = useState<State>('idle');
  const [suggestion, setSuggestion] = useState<ProductDescriptionSuggestion | null>(null);

  const handleGenerate = async () => {
    if (!name.trim()) {
      toast.error('Add a product name first — the AI needs it.');
      return;
    }
    // For a brand-new product (not yet saved) we don't have a
    // productId. We still want to give a preview so the user can
    // fill the rest of the form. We synthesise a fake id that
    // won't be used — the action just reads the name/category.
    const targetId = productId ?? 'pending';
    setState('loading');
    const res = await generateProductDescription(targetId);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't generate a description.");
      setState('error');
      return;
    }
    setSuggestion(res.data);
    setState('preview');
  };

  const handleAccept = () => {
    if (!suggestion) return;
    onChange(suggestion.description);
    setState('idle');
    setSuggestion(null);
    toast.success('Description added — edit freely, then save the product.');
  };

  const handleDiscard = () => {
    setSuggestion(null);
    setState('idle');
  };

  const handleRegenerate = () => {
    setSuggestion(null);
    void handleGenerate();
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1 block">
        Catalog description
      </label>

      <textarea
        value={description}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="What does the customer need to know? 1-2 short sentences is plenty. Click 'Generate with AI' for a first draft."
        className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:border-tactical-blue focus:outline-none resize-y"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={state === 'loading'}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest border transition-colors',
            'bg-tactical-purple/15 border-tactical-purple/40 text-tactical-purple hover:bg-tactical-purple/25',
            state === 'loading' && 'opacity-70 cursor-not-allowed'
          )}
        >
          {state === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          {state === 'loading' ? 'Generating…' : 'Generate with AI'}
        </button>
        <span className="text-[10px] text-white/30">
          Costs 1 AI call. Review before saving.
        </span>
      </div>

      {state === 'preview' && suggestion && (
        <div className="mt-2 p-3 rounded-xl border border-tactical-purple/30 bg-tactical-purple/5 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-tactical-purple">
              <Sparkles className="w-3 h-3" />
              AI suggestion
            </div>
            <button
              type="button"
              onClick={handleRegenerate}
              className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white"
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate
            </button>
          </div>

          {suggestion.category_label && (
            <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
              Category: <span className="text-white/70">{suggestion.category_label}</span>
            </p>
          )}

          <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">
            {suggestion.description}
          </p>

          {suggestion.highlights.length > 0 && (
            <ul className="space-y-1 pt-1 border-t border-tactical-purple/20">
              {suggestion.highlights.map((h, i) => (
                <li key={i} className="text-[11px] text-white/70 flex gap-1.5">
                  <span className="text-tactical-purple">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-tactical-purple/20">
            <button
              type="button"
              onClick={handleAccept}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest bg-tactical-neon/20 border border-tactical-neon/40 text-tactical-neon hover:bg-tactical-neon/30"
            >
              <Check className="w-3.5 h-3.5" />
              Use this
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
              Discard
            </button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <p className="text-[10px] text-tactical-red">
          Couldn&apos;t generate. Try again or type the description manually.
        </p>
      )}
    </div>
  );
}
