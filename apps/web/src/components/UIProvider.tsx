import React from 'react';
import { useUIStore } from '../stores/uiStore';

/**
 * ZTTeam UIProvider component
 * Renders borderless Toast notifications and Confirm Modal dialogs using exact project theme color tokens
 */
export default function UIProvider() {
  const { toasts, confirmState, ztteam_removeToast } = useUIStore();

  return (
    <>
      {/** Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl min-w-[320px] max-w-[420px] animate-[slideIn_0.3s_ease-out] backdrop-blur-xl transition-all ${
              toast.type === 'success'
                ? 'bg-fb-surface text-emerald-400 shadow-emerald-950/20'
                : toast.type === 'error'
                ? 'bg-fb-surface text-red-400 shadow-red-950/20'
                : 'bg-fb-surface text-fb-blue shadow-blue-950/20'
            }`}
          >
            <span
              className={`material-symbols-outlined shrink-0 text-[22px] ${
                toast.type === 'success'
                  ? 'text-emerald-400'
                  : toast.type === 'error'
                  ? 'text-red-400'
                  : 'text-fb-blue'
              }`}
              data-icon={toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            >
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            <p className="text-sm font-medium flex-1 text-fb-text">{toast.message}</p>
            <button
              onClick={() => ztteam_removeToast(toast.id)}
              className="p-1 hover:bg-fb-surface-hover text-fb-text-muted hover:text-fb-text rounded-lg transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="close">close</span>
            </button>
          </div>
        ))}
      </div>

      {/** Confirm Modal Dialog */}
      {confirmState && confirmState.isOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-fb-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-[zoomIn_0.2s_ease-out] backdrop-blur-2xl">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <span className="material-symbols-outlined text-[28px]" data-icon="warning">warning</span>
              </div>
              <h3 className="text-lg font-bold text-fb-text mb-2 tracking-wide">{confirmState.title}</h3>
              {confirmState.message && <p className="text-sm text-fb-text-muted leading-relaxed">{confirmState.message}</p>}
            </div>
            <div className="bg-fb-bg/80 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={confirmState.onCancel}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-fb-surface-hover text-fb-text-muted hover:text-fb-text transition-all"
              >
                Hủy
              </button>
              <button
                onClick={confirmState.onConfirm}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/40 transition-all active:scale-95"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



