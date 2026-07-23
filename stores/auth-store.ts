import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isLoading: false }),
    }),
    {
      name: 'ge-auth',
      partialize: (state) => ({ user: state.user }),
      // skipHydration prevents the persist middleware from rehydrating
      // synchronously on the client during the very first render. Without
      // this, the client render would have the persisted user (from
      // localStorage) but the server render would have null — triggering
      // React hydration mismatch errors (#418, #423) in the layout header.
      // We rehydrate manually in AuthProvider's useEffect instead, which
      // happens after mount, so the initial server/client renders match.
      skipHydration: true,
    }
  )
);