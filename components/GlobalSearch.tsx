'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Search, X, Package, User, ShoppingCart } from 'lucide-react';
import { useSearchStore } from '@/stores/search-store';
import { search } from '@/lib/actions/search';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const typeIcons = {
  product: Package,
  client: User,
  sale: ShoppingCart,
};

const typeColors = {
  product: 'text-tactical-blue',
  client: 'text-tactical-neon',
  sale: 'text-tactical-orange',
};

export function GlobalSearch() {
  const { query, results, isLoading, isOpen, setQuery, setResults, setLoading, setOpen, reset } =
    useSearchStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        reset();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setOpen, reset]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await search(query);
      setResults(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, setLoading, setResults]);

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href);
      setOpen(false);
      reset();
    },
    [router, setOpen, reset]
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="p-2 rounded-lg bg-tactical-slate hover:bg-white/10 transition-colors text-white/60"
        aria-label="Search"
      >
        <Search className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          className="w-48 bg-tactical-slate border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-tactical-blue"
        />
        <button
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="p-2 rounded-lg bg-tactical-slate hover:bg-white/10 transition-colors text-white/60"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Results dropdown */}
      {query.length >= 2 && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-tactical-slate border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {isLoading && (
            <div className="p-4 text-center text-white/40 text-sm">Searching...</div>
          )}

          {!isLoading && results.length === 0 && (
            <div className="p-4 text-center text-white/40 text-sm">No results found</div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {results.map((result) => {
                const Icon = typeIcons[result.type];
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors',
                      'border-b border-white/5 last:border-b-0'
                    )}
                  >
                    <Icon className={cn('w-4 h-4', typeColors[result.type])} />
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{result.name}</p>
                      {result.subtitle && (
                        <p className="text-xs text-white/40">{result.subtitle}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        'ml-auto text-[10px] uppercase font-semibold px-2 py-0.5 rounded',
                        result.type === 'product' && 'bg-tactical-blue/20 text-tactical-blue',
                        result.type === 'client' && 'bg-tactical-neon/20 text-tactical-neon',
                        result.type === 'sale' && 'bg-tactical-orange/20 text-tactical-orange'
                      )}
                    >
                      {result.type}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}