import { create } from 'zustand';
import api from '../services/api';

export interface ZTTeamFanpage {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
  followersCount?: number;
  avatar?: string;
  ownerName?: string;
  status?: string;
  isActive?: boolean;
  targetSiteId?: string;
  targetCategoryId?: string;
  reelFrequencyCron?: string;
  captionTone?: string;
  tags?: string[];
  postFormat?: string;
  scheduleMode?: string;
  autoPublishEnabled?: boolean;
  autoCreateEnabled?: boolean;
  nextPublishTime?: string | null;
  nextRenderTime?: string | null;
  scheduleFixedTimes?: string[];
  scheduleImmediateGapMinutes?: number;
  autoScanIntervalHours?: number;
  defaultReelTemplateId?: string;
  defaultReelTemplateName?: string | null;
  nextVideoTitle?: string | null;
}

interface ZTTeamFacebookState {
  isConnected: boolean;
  fbAccountId: string | null;
  pages: ZTTeamFanpage[];
  accounts: any[];
  isLoading: boolean;
  error: string | null;

  ztteam_checkLoginStatus: () => Promise<void>;
  ztteam_fetchPagesFromDB: () => Promise<void>;
  ztteam_fetchAccounts: () => Promise<void>;
  ztteam_loginWithFacebook: () => Promise<void>;
  ztteam_fetchPages: () => Promise<void>;
  ztteam_testPost: (pageId: string, message: string) => Promise<void>;
  ztteam_updatePageConfig: (pageId: string, config: any) => Promise<void>;
  ztteam_deletePage: (pageId: string) => Promise<void>;
  ztteam_deleteAccount: (accountId: string) => Promise<void>;
  ztteam_getPageReport: (pageId: string) => Promise<any>;
  ztteam_getTopPosts: (pageId: string) => Promise<any>;
}

declare global {
  interface Window {
    FB: any;
  }
}

export const useZTTeamFacebookStore = create<ZTTeamFacebookState>((set, get) => ({
  isConnected: false,
  fbAccountId: null,
  pages: [],
  accounts: [],
  isLoading: false,
  error: null,

  ztteam_checkLoginStatus: async () => {
    /** Load pages from backend DB immediately */
    await get().ztteam_fetchPagesFromDB();

    return new Promise((resolve) => {
      if (!window.FB) {
        resolve();
        return;
      }
      window.FB.getLoginStatus((response: any) => {
        if (response.status === 'connected') {
          set({ isConnected: true, fbAccountId: response.authResponse?.userID });
        }
        resolve();
      });
    });
  },

  ztteam_fetchPagesFromDB: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/facebook/pages');
      const pages = response.data;
      if (pages.length > 0) {
        set({ pages, isConnected: true, isLoading: false });
      } else {
        set({ pages: [], isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch pages from database', isLoading: false });
    }
  },

  ztteam_loginWithFacebook: async () => {
    set({ isLoading: true, error: null });
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        set({ error: 'Facebook SDK is not loaded', isLoading: false });
        reject(new Error('Facebook SDK is not loaded'));
        return;
      }
      
      window.FB.login((response: any) => {
        if (response.authResponse) {
          const { accessToken, userID } = response.authResponse;
          
          /** Gửi token ngắn hạn cho Backend đổi lấy token dài hạn */
          api.post('/facebook/exchange-token', { shortToken: accessToken, fbAccountId: userID })
            .then(() => {
              set({ isConnected: true, fbAccountId: userID, isLoading: false });
              return get().ztteam_fetchPages();
            })
            .then(() => resolve())
            .catch((error) => {
              set({ error: error.response?.data?.message || 'Failed to exchange token', isLoading: false });
              reject(error);
            });
        } else {
          set({ error: 'User cancelled login or did not fully authorize.', isLoading: false });
          reject(new Error('User cancelled login'));
        }
      }, { 
          scope: 'pages_show_list,pages_manage_posts,pages_read_engagement',
          auth_type: 'rerequest'
        });
    });
  },

  ztteam_fetchPages: async () => {
    const { fbAccountId } = get();
    set({ isLoading: true, error: null });
    try {
      if (fbAccountId) {
        await api.post(`/facebook/pages/${fbAccountId}/fetch`);
      }
      await get().ztteam_fetchPagesFromDB();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Failed to fetch pages', isLoading: false });
    }
  },

  ztteam_testPost: async (pageId: string, message: string) => {
    try {
      await api.post(`/facebook/pages/${pageId}/test-post`, { message });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Lỗi khi đăng bài test');
    }
  },

  ztteam_updatePageConfig: async (pageId: string, config: any) => {
    try {
      await api.put(`/facebook/pages/${pageId}/settings`, config);
      set((state) => ({
        pages: state.pages.map(p => p.id === pageId ? { ...p, ...config } : p)
      }));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Lỗi khi lưu cấu hình');
    }
  },

  ztteam_deletePage: async (pageId: string) => {
    try {
      await api.delete(`/facebook/pages/${pageId}`);
      await get().ztteam_fetchPagesFromDB();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Lỗi khi xóa Fanpage');
    }
  },

  ztteam_deleteAccount: async (accountId: string) => {
    try {
      await api.delete(`/facebook/accounts/${accountId}`);
      await get().ztteam_fetchAccounts();
      await get().ztteam_fetchPagesFromDB();
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Lỗi khi xóa tài khoản Facebook');
    }
  },

  ztteam_fetchAccounts: async () => {
    try {
      const response = await api.get('/facebook/accounts');
      set({ accounts: response.data || [] });
    } catch (error: any) {
      console.error('Error fetching fb accounts', error);
    }
  },

  ztteam_getPageReport: async (pageId: string) => {
    try {
      const response = await api.get(`/facebook/pages/${pageId}/report`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching page report', error);
      return [];
    }
  },

  ztteam_getTopPosts: async (pageId: string) => {
    try {
      const response = await api.get(`/facebook/pages/${pageId}/top-posts`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching top posts', error);
      return [];
    }
  }
}));
