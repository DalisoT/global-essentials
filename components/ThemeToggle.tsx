'use client';

import { useThemeStore } from '@/stores/theme-store';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-tactical-slate hover:bg-white/10 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5 text-white/70" />
      ) : (
        <Moon className="w-5 h-5 text-white/70" />
      )}
    </button>
  );
}