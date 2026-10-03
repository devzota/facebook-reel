import { create } from 'zustand';
import api from '../services/api';

interface ZTTeamUser {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: ZTTeamUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  ztteam_login: (email: string, password: string) => Promise<void>;
  ztteam_logout: () => void;
}

export const useZTTeamAuthStore = create<AuthState>((set) => {
  const storedUser = localStorage.getItem('ztteam_user');
  
  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    isAuthenticated: !!localStorage.getItem('ztteam_access_token'),
    isLoading: false,

    ztteam_login: async (email, password) => {
      set({ isLoading: true });
      try {
        const response = await api.post('/auth/login', { email, password });
        const { access_token, user } = response.data;
        localStorage.setItem('ztteam_access_token', access_token);
        localStorage.setItem('ztteam_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    ztteam_logout: () => {
      localStorage.removeItem('ztteam_access_token');
      localStorage.removeItem('ztteam_user');
      set({ user: null, isAuthenticated: false });
    },
  };
});
