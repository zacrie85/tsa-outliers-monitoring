import { create } from 'zustand';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
  divisionId: string | null;
  divisionName: string | null;
}

export interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  color: string;
  columnOrder: string;
  _count?: { rows: number; columns: number };
}

interface AppState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  activeTab: 'monitoring' | 'logs' | 'pivot' | 'admin' | 'settings';
  setActiveTab: (tab: AppState['activeTab']) => void;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  projects: ProjectInfo[];
  setProjects: (projects: ProjectInfo[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeTab: 'monitoring',
  setActiveTab: (activeTab) => set({ activeTab }),
  activeProjectId: 'default',
  setActiveProjectId: (activeProjectId) => set({ activeProjectId }),
  projects: [],
  setProjects: (projects) => set({ projects }),
}));
