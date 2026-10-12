import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ZTTeamRealtimeWidget() {
  const [data, setData] = useState<any>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const ztteam_fetchRealtime = async () => {
    try {
      const res = await api.get('/analytics/realtime-all');
      if (res.data) {
        setData(res.data);
      }
    } catch (e) {
      /** Bỏ qua lỗi kết nối ngầm */
    }
  };

  useEffect(() => {
    ztteam_fetchRealtime();
    const interval = setInterval(ztteam_fetchRealtime, 25000); /** Quét mỗi 25s */
    return () => clearInterval(interval);
  }, []);

  const totalActiveUsers = data?.totalActiveUsers || 0;
  const sites: any[] = data?.sites || [];
  const isConfigured = data?.configured;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-fb-surface-hover hover:bg-slate-800 text-fb-text border border-slate-700/60 transition-all text-xs font-semibold shadow-sm cursor-pointer select-none max-w-[320px] sm:max-w-[480px]"
        title={isConfigured ? `Tổng ${totalActiveUsers} người online trên các website` : 'Chưa cấu hình Google Analytics'}
      >
        {isConfigured && sites.length > 0 ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-2 overflow-hidden truncate">
              {sites.map((s, idx) => (
                <span key={s.id || idx} className="inline-flex items-center gap-1 shrink-0 text-xs">
                  <span className="text-emerald-400 font-bold font-mono">{s.activeUsers}</span>
                  <span className="text-fb-text-muted text-[11px] truncate max-w-[110px]">online {s.domain || s.name}</span>
                  {idx < sites.length - 1 && <span className="text-slate-600 font-bold">•</span>}
                </span>
              ))}
            </div>
          </>
        ) : isConfigured ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-bold font-mono">{totalActiveUsers}</span>
            <span className="text-fb-text-muted">Online</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            <span className="hidden sm:inline text-fb-text-muted">GA4:</span>
            <span className="text-amber-400 text-[11px]">Chưa cài</span>
          </>
        )}
      </button>

      {/** Dropdown Popover */}
      {showPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />
          <div className="absolute right-0 mt-2 w-84 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50 text-left space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-emerald-400">insights</span>
                <span className="font-bold text-sm text-white">Google Analytics Realtime</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  ztteam_fetchRealtime().finally(() => setIsLoading(false));
                }}
                className={`text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors ${isLoading ? 'animate-spin' : ''}`}
                title="Làm mới ngay"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>

            {isConfigured && sites.length > 0 ? (
              <>
                {/** Tổng số người online */}
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/50 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-400">Tổng độc giả trực tuyến</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono flex items-center gap-2">
                      {totalActiveUsers}
                      <span className="text-xs font-normal text-slate-400">người</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Số website</div>
                    <div className="text-lg font-bold text-cyan-400 font-mono">
                      {sites.length} site
                    </div>
                  </div>
                </div>

                {/** Danh sách từng site */}
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                    <span>Website theo dõi</span>
                    <span>Online</span>
                  </div>
                  {sites.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700/30 transition-colors"
                    >
                      <div className="truncate pr-2">
                        <div className="text-slate-200 font-semibold truncate" title={s.name}>
                          {s.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {s.domain}
                        </div>
                      </div>
                      <span className="font-bold font-mono text-emerald-400 shrink-0">
                        {s.activeUsers}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Cập nhật tự động
                  </span>
                  <Link
                    to="/google-analytics"
                    onClick={() => setShowPopover(false)}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Xem chi tiết GA4</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-2 text-center">
                <span className="material-symbols-outlined text-3xl text-amber-400">warning</span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Chưa cấu hình Google Analytics hoặc chưa có website nào trong danh sách.
                </p>
                <Link
                  to="/google-analytics"
                  onClick={() => setShowPopover(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  <span>Cài đặt ngay</span>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
