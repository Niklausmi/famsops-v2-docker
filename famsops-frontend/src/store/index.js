import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // ── Auth ─────────────────────────────────────────────
      user:        null,
      token:       null,
      permissions: [],
      _hydrated:   false,   // ← key flag: true once localStorage is loaded

      setUser: (user, token) => {
        set({ user, token, permissions: user.permissions || [] });
      },

      logout: () => {
        set({ user: null, token: null, permissions: [] });
        sessionStorage.clear();
      },

      setHydrated: () => set({ _hydrated: true }),

      // Permission check — O(1) includes on array
      can: (module, action) => {
        const { user, permissions } = get();
        if (!user) return false;
        if (user.role === 'admin') return true;
        return permissions.includes(`${module}.${action}`);
      },

      // ── Theme ────────────────────────────────────────────
      theme: 'dark',
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.classList.toggle('light', next === 'light');
      },
      initTheme: () => {
        document.documentElement.classList.toggle('light', get().theme === 'light');
      },

      // ── Nav ──────────────────────────────────────────────
      navCollapsed: false,
      toggleNav: () => set(s => ({ navCollapsed: !s.navCollapsed })),
    }),
    {
      name:    'famsops-store',
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({
        user:        s.user,
        token:       s.token,
        permissions: s.permissions,
        theme:       s.theme,
        navCollapsed:s.navCollapsed,
      }),
      // Called once rehydration from localStorage is complete
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);