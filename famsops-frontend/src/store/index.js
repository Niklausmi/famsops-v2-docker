import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────
      user: null,
      token: null,
      setUser: (user, token) => set({ user, token }),
      logout: () => {
        set({ user: null, token: null });
        sessionStorage.clear();
      },

      // ── Theme ────────────────────────────────────────────
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.classList.toggle('light', next === 'light');
      },
      initTheme: () => {
        const t = get().theme;
        document.documentElement.classList.toggle('light', t === 'light');
      },

      // ── Nav ──────────────────────────────────────────────
      navCollapsed: false,
      toggleNav: () => set(s => ({ navCollapsed: !s.navCollapsed })),
    }),
    {
      name: 'famsops-store',
      partialize: (s) => ({ user: s.user, token: s.token, theme: s.theme }),
    }
  )
);
