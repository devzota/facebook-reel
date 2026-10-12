import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';

interface GAConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ZTTeamGAConfigModal({ isOpen, onClose, onSaved }: GAConfigModalProps) {
  const { ztteam_showToast } = useUIStore();
  const [credentialsJson, setCredentialsJson] = useState('');
  const [defaultPropertyId, setDefaultPropertyId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; activeUsers?: number } | null>(null);

  /** Lấy thông tin cấu hình hiện tại */
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setTestResult(null);
      api.get('/analytics/config')
        .then((res) => {
          if (res.data) {
            setHasCredentials(res.data.hasCredentials || false);
            setClientEmail(res.data.clientEmail || '');
            setDefaultPropertyId(res.data.defaultPropertyId || '');
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  /** Xử lý đọc file JSON từ máy tính */
  const ztteam_handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCredentialsJson(content);
      try {
        const parsed = JSON.parse(content);
        if (parsed.client_email) {
          setClientEmail(parsed.client_email);
        }
      } catch (err) {
        ztteam_showToast('File JSON không hợp lệ', 'error');
      }
    };
    reader.readAsText(file);
  };

  /** Kiểm tra kết nối GA4 */
  const ztteam_handleTest = async () => {
    if (!defaultPropertyId.trim()) {
      ztteam_showToast('Vui lòng nhập GA4 Property ID để kiểm tra', 'warning');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      /** Nếu người dùng vừa dán JSON mới, lưu trước rồi test */
      if (credentialsJson.trim()) {
        await api.post('/analytics/config', {
          credentialsJson: credentialsJson.trim(),
          defaultPropertyId: defaultPropertyId.trim(),
        });
        setHasCredentials(true);
      }

      const res = await api.post('/analytics/test', {
        propertyId: defaultPropertyId.trim(),
      });

      setTestResult({
        success: true,
        message: res.data?.message || 'Kết nối GA4 thành công!',
        activeUsers: res.data?.activeUsers,
      });
      ztteam_showToast('Kiểm tra kết nối GA4 thành công!', 'success');
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Lỗi kết nối GA4',
      });
      ztteam_showToast('Kết nối GA4 thất bại', 'error');
    } finally {
      setIsTesting(false);
    }
  };

  /** Lưu cấu hình */
  const ztteam_handleSave = async () => {
    if (!hasCredentials && !credentialsJson.trim()) {
      ztteam_showToast('Vui lòng cung cấp nội dung file JSON Service Account', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/analytics/config', {
        credentialsJson: credentialsJson.trim() || undefined,
        defaultPropertyId: defaultPropertyId.trim(),
      });

      ztteam_showToast('Đã lưu cấu hình Google Analytics thành công!', 'success');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || 'Lỗi lưu cấu hình GA4', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-6 max-h-[90vh] overflow-y-auto">
        {/** Header Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <span className="material-symbols-outlined text-2xl">analytics</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Cấu Hình Google Analytics 4 (Realtime)</h3>
              <p className="text-xs text-slate-400">Kết nối Service Account để theo dõi người dùng online theo thời gian thực</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/** Hướng dẫn nhanh */}
        <div className="p-3.5 bg-blue-950/40 border border-blue-500/30 rounded-2xl text-xs text-blue-200/90 space-y-1.5 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-blue-300">
            <span className="material-symbols-outlined text-sm">info</span>
            <span>2 bước đơn giản để kết nối:</span>
          </div>
          <ol className="list-decimal pl-5 space-y-1 text-slate-300 text-[11px]">
            <li>
              Tạo Service Account trên <strong>Google Cloud Console</strong>, bật <em>Google Analytics Data API</em>, tải file khóa <strong>JSON</strong>.
            </li>
            <li>
              Vào <strong>Google Analytics ➔ Quản trị ➔ Quản lý quyền truy cập</strong>: Thêm email Service Account với quyền <strong>Người xem (Viewer)</strong>.
            </li>
          </ol>
        </div>

        {/** Form Fields */}
        <div className="space-y-4">
          {/** Trạng thái hiện tại */}
          {hasCredentials && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-lg">check_circle</span>
                <div>
                  <span className="text-xs font-bold text-emerald-300 block">Đã có file Service Account JSON</span>
                  {clientEmail && (
                    <span className="text-[11px] text-slate-400 font-mono select-all">Email: {clientEmail}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(clientEmail);
                  ztteam_showToast('Đã sao chép Email Service Account', 'success');
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg border border-emerald-500/30 transition-all cursor-pointer"
                title="Sao chép email để cấp quyền trong GA4"
              >
                Copy Email
              </button>
            </div>
          )}

          {/** Upload hoặc Dán JSON */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-200 flex items-center gap-1.5">
                <span>File Khóa Service Account JSON:</span>
                <span className="text-rose-400">*</span>
              </label>
              <label className="text-[11px] font-bold text-blue-400 hover:text-blue-300 cursor-pointer flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">upload_file</span>
                <span>Tải tệp .json từ máy tính</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={ztteam_handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <textarea
              rows={4}
              value={credentialsJson}
              onChange={(e) => setCredentialsJson(e.target.value)}
              placeholder={hasCredentials ? 'Đã có khóa JSON. Dán vào đây nếu bạn muốn cập nhật file JSON mới...' : 'Dán toàn bộ nội dung file credentials.json tải từ Google Cloud vào đây...'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-y"
            />
          </div>

          {/** Default Property ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-200">
              GA4 Property ID Mặc Định:
            </label>
            <div className="relative">
              <input
                type="text"
                value={defaultPropertyId}
                onChange={(e) => setDefaultPropertyId(e.target.value)}
                placeholder="Ví dụ: 432891045 (dãy số trong cài đặt GA4)"
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 material-symbols-outlined text-base">
                tag
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Lấy tại Google Analytics ➔ Quản trị (Admin) ➔ Chi tiết thuộc tính (Property Details) ➔ Mã thuộc tính (Property ID).
            </p>
          </div>

          {/** Kết quả test kết nối */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5 ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                {testResult.success ? 'verified' : 'error'}
              </span>
              <div className="space-y-1">
                <div className="font-bold">{testResult.message}</div>
                {testResult.success && testResult.activeUsers !== undefined && (
                  <div className="text-[11px] text-emerald-400/90 font-mono">
                    🟢 Hiện tại có <strong>{testResult.activeUsers}</strong> độc giả đang online trên website!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/** Footer Buttons */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={ztteam_handleTest}
            disabled={isTesting || (!hasCredentials && !credentialsJson.trim())}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined text-base ${isTesting ? 'animate-spin' : ''}`}>
              {isTesting ? 'progress_activity' : 'bolt'}
            </span>
            <span>{isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={ztteam_handleSave}
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>{isLoading ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
