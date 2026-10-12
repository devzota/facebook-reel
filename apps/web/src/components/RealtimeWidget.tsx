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
    const interval = setInterval(ztteam_fetchRealtime, 35000); /** Quét mỗi 35s */
    return () => clearInterval(interval);
  }, []);

  const totalActiveUsers = data?.totalActiveUsers || 0;
  const sites: any[] = data?.sites || [];
  const isConfigured = data?.configured;

  return (
    <div className="relative">
      {/** Button ticker Header: radius full, không dùng border cứng */}
      <button
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-fb-surface hover:bg-fb-surface-hover text-fb-text transition-all text-xs font-semibold shadow-sm cursor-pointer select-none max-w-[340px] sm:max-w-[500px]"
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
                  <span className="text-fb-text-muted text-[11px] truncate max-w-[120px]">online {s.domain || s.name}</span>
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

      {/** Dropdown Popover Card: Rộng rãi (440px - 480px), không viền thô, shadow-2xl mềm mại */}
      {showPopover && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowPopover(false)}
          />
          <div className="absolute right-0 mt-2.5 w-[360px] sm:w-[460px] bg-fb-surface rounded-2xl shadow-2xl p-5 z-50 text-left space-y-4 animate-in fade-in duration-200">
            {/** Header Popover */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">insights</span>
                </div>
                <div>
                  <h4 className="font-black text-sm text-fb-text">Google Analytics Realtime</h4>
                  <p className="text-[11px] text-fb-text-muted">Theo dõi trực tiếp theo thời gian thực</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  ztteam_fetchRealtime().finally(() => setIsLoading(false));
                }}
                className={`p-2 rounded-full text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover transition-colors cursor-pointer ${isLoading ? 'animate-spin' : ''}`}
                title="Làm mới số liệu ngay"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
              </button>
            </div>

            {isConfigured && sites.length > 0 ? (
              <>
                {/** Tổng quan nhanh */}
                <div className="bg-fb-surface-hover/40 p-4 rounded-2xl shadow-inner flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-bold text-fb-text-muted uppercase tracking-wider">Tổng Độc Giả Trực Tuyến</div>
                    <div className="text-3xl font-black text-emerald-400 font-mono flex items-center gap-2 mt-0.5">
                      {totalActiveUsers}
                      <span className="text-xs font-normal text-fb-text-muted">người online</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/15 text-cyan-400">
                      <span className="material-symbols-outlined text-xs">language</span>
                      <span>{sites.length} Website</span>
                    </span>
                  </div>
                </div>

                {/** Quota Warning nếu Google đang nạp lại token */}
                {data?.quotaWarning && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span className="truncate">Google đang nạp lại Token theo giờ, giữ số liệu gần nhất.</span>
                  </div>
                )}

                {/** Danh sách chi tiết từng website */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <div className="text-[11px] font-black uppercase tracking-wider text-fb-text-muted flex items-center justify-between px-1">
                    <span>Website Theo Dõi</span>
                    <span>Đang Online</span>
                  </div>
                  {sites.map((s, idx) => (
                    <div
                      key={s.id || idx}
                      className="flex items-center justify-between p-3 rounded-2xl bg-fb-surface-hover/30 hover:bg-fb-surface-hover/70 transition-colors shadow-xs"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-fb-text font-bold text-xs truncate" title={s.name}>
                          {s.name}
                        </div>
                        <div className="text-[11px] text-fb-text-muted font-mono truncate">
                          {s.domain || `Property #${s.propertyId}`}
                        </div>
                        {s.topArticles?.[0] && (
                          <div className="text-[10px] text-slate-400 truncate mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px] text-slate-500">article</span>
                            <span className="truncate">{s.topArticles[0].title}</span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black font-mono bg-emerald-500/15 text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>{s.activeUsers}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/** Footer: Nút Xem chi tiết chuẩn radius full */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[11px] text-fb-text-muted">
                    Tự động đồng bộ mỗi 35s
                  </span>
                  <Link
                    to="/google-analytics"
                    onClick={() => setShowPopover(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-fb-blue hover:bg-blue-600 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                  >
                    <span>Vào Trang Google Analytics</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-3 text-center">
                <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">warning</span>
                </div>
                <p className="text-xs text-fb-text-muted leading-relaxed max-w-xs mx-auto">
                  Chưa cấu hình Service Account JSON hoặc chưa có website nào trong danh sách theo dõi.
                </p>
                <Link
                  to="/google-analytics"
                  onClick={() => setShowPopover(false)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-fb-blue hover:bg-blue-600 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                  <span>Cài Đặt Ngay</span>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
