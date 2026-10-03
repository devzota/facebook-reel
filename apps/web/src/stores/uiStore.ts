import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

interface UIState {
  toasts: Toast[];
  confirmState: ConfirmState | null;
  ztteam_showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  ztteam_removeToast: (id: string) => void;
  ztteam_showConfirm: (title: string, message?: string) => Promise<boolean>;
  ztteam_closeConfirm: () => void;
  isDarkMode: boolean;
  ztteam_toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>((set) => {
  const initialDarkMode = localStorage.getItem('ztteam_dark_mode') === 'true';
  if (initialDarkMode) {
    document.documentElement.classList.add('dark');
  }

  return {
  toasts: [],
  confirmState: null,
  isDarkMode: initialDarkMode,

  ztteam_toggleDarkMode: () => {
    set((state) => {
      const newDarkMode = !state.isDarkMode;
      localStorage.setItem('ztteam_dark_mode', String(newDarkMode));
      if (newDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { isDarkMode: newDarkMode };
    });
  },

  ztteam_showToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 3000);
  },

  ztteam_removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  ztteam_showConfirm: (title, message) => {
    return new Promise((resolve) => {
      set({
        confirmState: {
          isOpen: true,
          title,
          message,
          onConfirm: () => {
            set({ confirmState: null });
            resolve(true);
          },
          onCancel: () => {
            set({ confirmState: null });
            resolve(false);
          }
        }
      });
    });
  },

  ztteam_closeConfirm: () => {
    set((state) => {
      if (state.confirmState) {
        state.confirmState.onCancel();
      }
      return { confirmState: null };
    });
  }
};
});
