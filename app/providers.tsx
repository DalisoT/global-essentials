'use client';

import { useEffect } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase-browser';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/types/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          const userData: User = profile
            ? {
                id: user.id,
                email: user.email,
                fullName: profile.full_name || '',
                role: (profile.role as 'staff' | 'admin') || 'staff',
                preferences: profile.preferences || {},
              }
            : {
                id: user.id,
                email: user.email,
                fullName: user.email?.split('@')[0] || '',
                role: 'staff',
                preferences: {},
              };

          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err) {
        // Auth lock race condition - retry once
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) setUser({ id: user.id, email: user.email, fullName: user.email?.split('@')[0] || '', role: 'staff', preferences: {} });
          else setUser(null);
        } catch {
          setUser(null);
        }
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getUser();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}