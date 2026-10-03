import { create } from 'zustand';
import api from '../services/api';

interface TargetSite {
  id: string;
  wp_url: string;
  wp_username: string;
  status: string;
  created_at: string;
  _count?: {
    crawl_sources: number;
  };
}

interface WordpressState {
  sites: TargetSite[];
  isLoading: boolean;
  error: string | null;
  ztteam_fetchSites: () => Promise<void>;
  ztteam_createSite: (data: { wpUrl: string; wpUsername: string; wpAppPassword: string }) => Promise<void>;
  ztteam_updateSite: (id: string, data: { wpUrl: string; wpUsername: string; wpAppPassword?: string }) => Promise<void>;
  ztteam_deleteSite: (id: string) => Promise<void>;
  ztteam_testConnection: (data: { wpUrl: string; wpUsername: string; wpAppPassword?: string }) => Promise<any>;
  ztteam_testPost: (siteId: string, data: { title: string; content: string; excerpt?: string; imageUrl?: string }) => Promise<any>;
  ztteam_fetchCategories: (siteId: string) => Promise<any[]>;
  ztteam_fetchTags: (siteId: string) => Promise<any[]>;
}

export const useWordpressStore = create<WordpressState>((set, get) => ({
  sites: [],
  isLoading: false,
  error: null,

  ztteam_fetchSites: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/wordpress/sites');
      set({ sites: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch WordPress sites', isLoading: false });
    }
  },

  ztteam_createSite: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/wordpress/sites', data);
      await get().ztteam_fetchSites();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to create site', isLoading: false });
      throw error;
    }
  },

  ztteam_updateSite: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.patch(`/wordpress/sites/${id}`, data);
      await get().ztteam_fetchSites();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to update site', isLoading: false });
      throw error;
    }
  },

  ztteam_deleteSite: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/wordpress/sites/${id}`);
      set((state) => ({
        sites: state.sites.filter(site => site.id !== id),
        isLoading: false
      }));
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to delete site', isLoading: false });
      throw error;
    }
  },

  ztteam_testConnection: async (data) => {
    try {
      const response = await api.post('/wordpress/test-connection', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  ztteam_testPost: async (siteId, data) => {
    try {
      const response = await api.post(`/wordpress/sites/${siteId}/test-post`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  ztteam_fetchCategories: async (siteId) => {
    try {
      const response = await api.get(`/wordpress/sites/${siteId}/categories`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  ztteam_fetchTags: async (siteId) => {
    try {
      const response = await api.get(`/wordpress/sites/${siteId}/tags`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  }
}));
