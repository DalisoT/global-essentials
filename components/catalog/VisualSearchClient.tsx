'use client';

import { useState, useRef, useTransition } from 'react';
import Link from 'next/link';
import { Camera, Loader2, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import {
  searchByImage,
  type VisualSearchResult,
} from '@/lib/actions/catalog';

/**
 * VisualSearchClient (Phase 8 / 8.2).
 *
 * Client component used on the public /catalog/visual-search page.
 * Lets the user:
 *   1. Upload or drag-drop a product photo
 *   2. Optionally add a hint ('something like a black wallet')
 *   3. Click Search — calls the visualSearch() server action which
 *      sends the image + a list of catalog product names to Groq's
 *      vision model
 *   4. See the top 1-3 matches with thumbnails, names, and prices
 *
 * Why no auth: catalog browsing is anonymous. The action runs as
 * anon via the public Supabase client.
 */

interface VisualSearchClientProps {
  /** Max image size in MB; defaults to 4 (Groq's limit is around 5). */
  maxSizeMb?: number;
}

const MAX_IMAGE_DIMENSION = 1024; // downscale before sending

export function VisualSearchClient({ maxSizeMb = 4 }: VisualSearchClientProps) {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<VisualSearchResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, or WebP).');
      return;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Image is too large. Max ${maxSizeMb}MB.`);
      return;
    }
    // Read as base64 + downscale via canvas to keep the request
    // payload small (Groq charges by tokens; image tokens scale
    // with pixel area).
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      void downscale(raw, MAX_IMAGE_DIMENSION).then((scaled) => {
        setImageDataUrl(scaled);
        setResult(null);
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit() {
    if (!imageDataUrl) {
      toast.error('Add a photo first.');
      return;
    }
    startTransition(async () => {
      const res = await searchByImage({
        imageUrl: imageDataUrl,
        hint: hint.trim() || undefined,
      });
      if (res.error || !res.data) {
        toast.error(res.error ?? "Couldn't search the catalog.");
        return;
      }
      setResult(res.data);
      if (res.data.matches.length === 0) {
        toast.message("No close matches in the catalog. Try a different angle or add a hint.");
      }
    });
  }

  function handleClear() {
    setImageDataUrl(null);
    setHint('');
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-5">
      {/* Image picker */}
      <div
        className={cn(
          'card-tactical border-2 border-dashed p-4 text-center transition-colors',
          imageDataUrl
            ? 'border-tactical-neon/40 bg-tactical-neon/5'
            : 'border-white/10 bg-white/[0.02] hover:border-tactical-blue/40'
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {imageDataUrl ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="Uploaded product"
              className="max-h-64 rounded-xl border border-white/10"
            />
            <button
              type="button"
              onClick={handleClear}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-tactical-red text-white flex items-center justify-center"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <Camera className="w-10 h-10 text-white/20 mx-auto" />
            <p className="text-sm font-bold">Drop a product photo here</p>
            <p className="text-xs text-white/40">or</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] font-black uppercase tracking-widest bg-tactical-blue/20 border border-tactical-blue/40 text-tactical-blue hover:bg-tactical-blue/30"
            >
              Choose file
            </button>
            <p className="text-[10px] text-white/30 mt-2">JPEG, PNG, or WebP · up to {maxSizeMb}MB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>

      {/* Hint */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-white/60 block">
          Hint (optional)
        </label>
        <input
          type="text"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={200}
          placeholder='e.g. "something like a black leather wallet"'
          className="w-full h-11 px-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:border-tactical-blue focus:outline-none"
        />
      </div>

      {/* Search button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !imageDataUrl}
        className={cn(
          'w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors',
          'bg-tactical-blue/20 border border-tactical-blue/40 text-tactical-blue',
          'hover:bg-tactical-blue/30',
          (isPending || !imageDataUrl) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching the catalog…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Find similar products
          </>
        )}
      </button>

      {/* Results */}
      {result && result.matches.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-tactical-neon">
            <Sparkles className="w-3 h-3" />
            Top {result.matches.length} match{result.matches.length === 1 ? '' : 'es'}
          </div>
          <div className="space-y-2">
            {result.matches.map((m) => (
              <Link
                key={m.product.id}
                href={`/catalog/${m.product.id}`}
                className="card-tactical flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
              >
                <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-white/5">
                  {m.product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.product.images[0]}
                      alt={m.product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                      —
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{m.product.name}</p>
                  <p className="text-base font-black text-tactical-neon mt-0.5">
                    {formatCurrency(m.product.selling_price)}
                  </p>
                  {m.product.description && (
                    <p className="text-[11px] text-white/50 mt-0.5 line-clamp-2">
                      {m.product.description}
                    </p>
                  )}
                </div>
                {m.rank === 0 && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-tactical-neon/20 text-tactical-neon">
                    Best match
                  </span>
                )}
              </Link>
            ))}
          </div>
          {result.unmatched.length > 0 && (
            <p className="text-[10px] text-white/30">
              Note: the AI suggested {result.unmatched.length} name
              {result.unmatched.length === 1 ? '' : 's'} we couldn&apos;t find in the catalog.
            </p>
          )}
        </div>
      )}

      {result && result.matches.length === 0 && (
        <div className="card-tactical text-center py-8 text-white/40 text-sm">
          <p>No close matches in the catalog.</p>
          <p className="text-xs mt-1">Try a different angle or add a hint.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Downscale the image to keep the request payload small.
// Groq's vision models bill by image tokens, which scale with
// pixel area. 1024px on the longest side is plenty for matching.
// ─────────────────────────────────────────────────────────────────────

async function downscale(dataUrl: string, maxDim: number): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }
    const img = window.document.createElement('img');
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = window.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      // JPEG with 0.85 quality is a good size/quality balance.
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
