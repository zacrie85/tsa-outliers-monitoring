import { create } from 'zustand';

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
  divisionId: string | null;
  divisionName: string | null;
}

interface AppState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  activeTab: 'monitoring' | 'logs' | 'dashboard' | 'pivot' | 'admin' | 'settings';
  setActiveTab: (tab: AppState['activeTab']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeTab: 'monitoring',
  setActiveTab: (activeTab) => set({ activeTab }),
}));
