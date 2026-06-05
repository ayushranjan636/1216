import { create } from 'zustand';
import type { ThemeMode } from '@/types';

const stored = (localStorage.getItem('1216_theme') as ThemeMode | null) ?? 'dark';

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: stored,
  setTheme: (theme) => {
    localStorage.setItem('1216_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

document.documentElement.setAttribute('data-theme', stored);
