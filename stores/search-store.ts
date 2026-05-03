import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SearchResult {
  id: string;
  type: 'product' | 'client' | 'sale';
  name: string;
  subtitle?: string;
  href: string;
}

interface SearchStore {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  setLoading: (loading: boolean) => void;
  setOpen: (open: boolean) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchStore>()(
  persist(
    (set) => ({
      query: '',
      results: [],
      isLoading: false,
      isOpen: false,
      setQuery: (query) => set({ query }),
      setResults: (results) => set({ results, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setOpen: (isOpen) => set({ isOpen }),
      reset: () => set({ query: '', results: [], isLoading: false }),
    }),
    {
      name: 'ge-search',
      partialize: (state) => ({ isOpen: state.isOpen }),
    }
  )
);