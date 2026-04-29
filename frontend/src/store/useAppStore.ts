import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Project } from '../types';

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;

  // Active project
  activeProjectId: string | null;
  setActiveProject: (id: string) => void;

  // UI
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;

  // Theme
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;

  // Recent projects cache
  recentProjects: Project[];
  addRecentProject: (p: Project) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem('agileflow_token', token);
        set({ user, token });
      },
      logout: () => {
        localStorage.removeItem('agileflow_token');
        set({ user: null, token: null, activeProjectId: null });
      },

      activeProjectId: null,
      setActiveProject: (id) => set({ activeProjectId: id }),

      sidebarCollapsed: false,
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      theme: 'dark',
      setTheme: (t) => {
        document.documentElement.setAttribute('data-theme', t);
        set({ theme: t });
      },

      recentProjects: [],
      addRecentProject: (p) => set(s => ({
        recentProjects: [p, ...s.recentProjects.filter(r => r.id !== p.id)].slice(0, 5),
      })),
    }),
    {
      name: 'agileflow-store',
      partialize: (s) => ({ user: s.user, token: s.token, activeProjectId: s.activeProjectId, recentProjects: s.recentProjects, theme: s.theme }),
    }
  )
);
