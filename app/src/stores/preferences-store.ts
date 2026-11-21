import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export const usePreferences = create(
  persist<{
    language: 'en' | 'ta';
    sidebarOpen: boolean;
    setLanguage: (v: 'en' | 'ta') => void;
    toggleSidebar: () => void;
  }>(
    (set) => ({
      language: 'en',
      sidebarOpen: false,
      setLanguage: (language) => set({ language }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: 'boatcore-preferences', partialize: (s) => ({ language: s.language }) as any },
  ),
);
