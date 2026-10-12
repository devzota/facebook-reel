import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';

interface ZTTeamMonitoredSite {
  id: string;
  name: string;
  domain: string;
  propertyId: string;
  active: boolean;
}

interface ZTTeamSiteRealtimeData {
  id: string;
  name: string;
  domain: string;
  propertyId: string;
  activeUsers: number;
  topArticles: Array<{ title: string; activeUsers: number }>;
  topCountries: Array<{ country: string; activeUsers: number }>;
  ga4Url: string;
  error?: string;
}

export default function GoogleAnalyticsPage() {
  const { ztteam_showToast } = useUIStore();

  const [realtimeData, setRealtimeData] = useState<{
    configured: boolean;
    totalActiveUsers: number;
    sites: ZTTeamSiteRealtimeData[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  /** Config State */
  const [configCredentialsJson, setConfigCredentialsJson] = useState('');
  const [configClientEmail, setConfigClientEmail] = useState('');
  const [configSites, setConfigSites] = useState<ZTTeamMonitoredSite[]>([]);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null);

  /** ZTTeam: Tải dữ liệu Realtime toàn bộ website */
  const ztteam_fetchRealtimeAll = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await api.get('/analytics/realtime-all');
      if (res.data) {
        setRealtimeData(res.data);
      }
    } catch (err: any) {
      if (isManual) {
        ztteam_showToast(err.response?.data?.message || 'Lỗi tải dữ liệu GA4', 'error');
      }
    } finally {
      setIsLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  /** ZTTeam: Tải cấu hình GA4 tập trung */
  const ztteam_fetchConfig = async () => {
    try {
      const res = await api.get('/analytics/config');
      if (res.data) {
        setConfigCredentialsJson(res.data.credentialsJson || '');
        setConfigClientEmail(res.data.clientEmail || '');
        if (Array.isArray(res.data.monitoredSites) && res.data.monitoredSites.length > 0) {
          setConfigSites(res.data.monitoredSites);
        } else {
          setConfigSites([
            {
              id: 'site_1',
              name: 'Thiệp Online',
              domain: 'thieponline.store',
              propertyId: res.data.defaultPropertyId || '520258342',
              active: true,
            },
          ]);
        }
      }
    } catch (err: any) {
      /** Bỏ qua lỗi ngầm */
    }
  };

  useEffect(() => {
    ztteam_fetchRealtimeAll();
    ztteam_fetchConfig();

    /** Tự động quét lại số liệu mỗi 30 giây */
    const interval = setInterval(() => {
      ztteam_fetchRealtimeAll(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  /** Xử lý đọc file JSON Service Account tải lên từ máy tính */
  const ztteam_handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.client_email && parsed.private_key) {
          setConfigCredentialsJson(text);
          setConfigClientEmail(parsed.client_email);
          ztteam_showToast(`Đã nạp file JSON Service Account: ${parsed.client_email}`, 'success');
        } else {
          ztteam_showToast('File JSON không hợp lệ (thiếu client_email hoặc private_key)', 'error');
        }
      } catch (err) {
        ztteam_showToast('File JSON không đúng định dạng', 'error');
      }
    };
    reader.readAsText(file);
  };

  /** Thêm website mới vào danh sách giám sát */
  const ztteam_handleAddSite = () => {
    const newId = `site_${Date.now()}`;
    setConfigSites([
      ...configSites,
      {
        id: newId,
        name: `Website Mới #${configSites.length + 1}`,
        domain: '',
        propertyId: '',
        active: true,
      },
    ]);
  };

  /** Cập nhật thông tin từng website */
  const ztteam_handleUpdateSite = (id: string, field: keyof ZTTeamMonitoredSite, value: any) => {
    setConfigSites(prev =>
      prev.map(s => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  /** Xóa website khỏi danh sách giám sát */
  const ztteam_handleDeleteSite = (id: string) => {
    if (configSites.length <= 1) {
      ztteam_showToast('Hệ thống cần ít nhất 1 website trong cấu hình', 'error');
      return;
    }
    setConfigSites(prev => prev.filter(s => s.id !== id));
  };

  /** Thử nghiệm kết nối riêng cho từng Property ID */
  const ztteam_handleTestSite = async (siteId: string, propertyId: string) => {
    if (!propertyId || !propertyId.trim()) {
      ztteam_showToast('Vui lòng nhập Property ID trước khi kiểm tra', 'error');
      return;
    }

    setTestingSiteId(siteId);
    try {
      const res = await api.post('/analytics/test', { propertyId: propertyId.trim() });
      if (res.data?.success) {
        ztteam_showToast(`Kết nối thành công! Đang có ${res.data.activeUsers} người online`, 'success');
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || 'Kết nối thất bại. Kiểm tra quyền truy cập!', 'error');
    } finally {
      setTestingSiteId(null);
    }
  };

  /** Lưu toàn bộ cấu hình GA4 tập trung */
  const ztteam_handleSaveConfig = async () => {
    if (!configCredentialsJson.trim()) {
      ztteam_showToast('Vui lòng nhập hoặc tải file JSON Service Account', 'error');
      return;
    }

    setIsSavingConfig(true);
    try {
      const firstActivePropId = configSites.find(s => s.active && s.propertyId)?.propertyId || configSites[0]?.propertyId || '';
      
      const res = await api.post('/analytics/config', {
        credentialsJson: configCredentialsJson.trim(),
        defaultPropertyId: firstActivePropId,
        monitoredSites: configSites,
      });

      if (res.data?.success) {
        ztteam_showToast('Đã lưu cấu hình Google Analytics thành công!', 'success');
        setShowConfigModal(false);
        ztteam_fetchRealtimeAll(true);
      }
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || 'Lỗi lưu cấu hình', 'error');
    } finally {
      setIsSavingConfig(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/** Header Bar */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-fb-surface-hover/50">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-2xl">insights</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight">Google Analytics 4 Realtime</h2>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{realtimeData?.totalActiveUsers !== undefined ? `${realtimeData.totalActiveUsers} Người Đang Online` : 'Đang đồng bộ...'}</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-fb-text-muted mt-1">
              Theo dõi người dùng trực tuyến theo thời gian thực trên toàn bộ hệ thống website.
            </p>
          </div>
        </div>

        {/** Actions */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => ztteam_fetchRealtimeAll(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-fb-surface-hover hover:bg-slate-800 text-fb-text font-bold text-xs border border-slate-700/60 shadow-sm transition-all cursor-pointer"
            title="Làm mới số liệu ngay"
          >
            <span className={`material-symbols-outlined text-base ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`}>
              refresh
            </span>
            <span className="hidden sm:inline">Làm Mới</span>
          </button>

          <button
            onClick={() => {
              ztteam_fetchConfig();
              setShowConfigModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-fb-blue hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            <span>Cài Đặt GA4</span>
          </button>
        </div>
      </div>

      {/** Danh Sách Website Cards (Mỗi site 1 card riêng biệt) */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-fb-surface rounded-2xl p-5 border border-fb-surface-hover/50 space-y-4">
              <div className="h-6 bg-fb-surface-hover rounded-xl w-40"></div>
              <div className="h-16 bg-fb-surface-hover/60 rounded-xl"></div>
              <div className="h-28 bg-fb-surface-hover/40 rounded-xl"></div>
            </div>
          ))}
        </div>
      ) : (!realtimeData?.sites || realtimeData.sites.length === 0) ? (
        <div className="bg-fb-surface rounded-2xl p-10 border border-fb-surface-hover/50 text-center space-y-4 shadow-lg">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl">cloud_off</span>
          </div>
          <h3 className="text-lg font-bold text-fb-text">Chưa cấu hình theo dõi website nào</h3>
          <p className="text-xs sm:text-sm text-fb-text-muted max-w-md mx-auto">
            Hệ thống chưa kết nối với Google Analytics. Bấm vào nút Cài Đặt GA4 ở trên để tải mã Service Account JSON và nhập Property ID của các website cần theo dõi.
          </p>
          <button
            onClick={() => {
              ztteam_fetchConfig();
              setShowConfigModal(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-fb-blue hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            <span>Cấu Hình GA4 Ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {realtimeData.sites.map((site) => (
            <div
              key={site.id}
              className="bg-fb-surface rounded-2xl border border-fb-surface-hover/50 shadow-lg p-5 flex flex-col justify-between hover:border-slate-600/60 transition-all"
            >
              {/** Header Card: Tên site, domain, badge online */}
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-fb-surface-hover/40 pb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-emerald-400">language</span>
                      <h3 className="font-black text-base text-fb-text truncate" title={site.name}>
                        {site.name}
                      </h3>
                    </div>
                    <p className="text-xs text-fb-text-muted truncate mt-0.5 font-mono">
                      {site.domain || 'Domain'} • ID: {site.propertyId}
                    </p>
                  </div>

                  {/** 1: Số người đang online */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                        {site.activeUsers}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-fb-text-muted uppercase tracking-wider">
                      Đang Online
                    </span>
                  </div>
                </div>

                {/** Nội dung card: 2. Ở nước nào + 3. Title bài viết đang online */}
                <div className="space-y-4 pt-4">
                  {/** 2: Ở nước nào */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-cyan-400">public</span>
                        <span>Quốc Gia Đang Truy Cập</span>
                      </span>
                      <span>Online</span>
                    </div>

                    {site.topCountries && site.topCountries.length > 0 ? (
                      <div className="space-y-1.5">
                        {site.topCountries.slice(0, 4).map((countryItem, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-fb-surface-hover/40 text-xs border border-fb-surface-hover/60"
                          >
                            <span className="font-semibold text-fb-text truncate max-w-[200px]">
                              {countryItem.country}
                            </span>
                            <span className="font-mono font-bold text-cyan-400 shrink-0 ml-2">
                              {countryItem.activeUsers}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fb-text-muted italic py-1 bg-fb-surface-hover/20 rounded-xl px-2.5 text-center">
                        Chưa ghi nhận quốc gia
                      </p>
                    )}
                  </div>

                  {/** 3: Title bài viết đang online là gì */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-emerald-400">article</span>
                        <span>Bài Viết Đang Được Đọc</span>
                      </span>
                      <span>Online</span>
                    </div>

                    {site.topArticles && site.topArticles.length > 0 ? (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {site.topArticles.slice(0, 5).map((article, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl bg-fb-surface-hover/40 hover:bg-fb-surface-hover text-xs border border-fb-surface-hover/60 transition-colors"
                          >
                            <span
                              className="font-medium text-fb-text line-clamp-2 text-[11px] leading-tight"
                              title={article.title}
                            >
                              {article.title}
                            </span>
                            <span className="font-mono font-bold text-emerald-400 shrink-0 ml-1">
                              {article.activeUsers}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fb-text-muted italic py-1 bg-fb-surface-hover/20 rounded-xl px-2.5 text-center">
                        Chưa có độc giả đọc bài
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/** Footer Card: Link mở App GA4 của Google */}
              <div className="border-t border-fb-surface-hover/40 pt-3 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-fb-text-muted font-mono">
                  Property #{site.propertyId}
                </span>

                <a
                  href={site.ga4Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-fb-blue hover:text-blue-400 transition-colors"
                  title="Mở báo cáo đầy đủ trong app Google Analytics"
                >
                  <span>Mở GA4 Trực Tiếp</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/** MODAL: Cài đặt GA4 tập trung (Gom toàn bộ cài đặt về 1 chỗ) */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setShowConfigModal(false)}
          />
          <div className="relative bg-fb-surface rounded-2xl border border-fb-surface-hover shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
            {/** Header Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-fb-surface-hover/50 bg-fb-surface">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-fb-blue flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">settings</span>
                </div>
                <div>
                  <h3 className="font-black text-lg text-fb-text">Cài Đặt Google Analytics Tập Trung</h3>
                  <p className="text-xs text-fb-text-muted">Quản lý Service Account JSON và danh sách tất cả các website theo dõi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-fb-text-muted hover:text-fb-text p-1.5 rounded-xl hover:bg-fb-surface-hover transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/** Body Modal */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {/** 1. Service Account JSON */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-fb-text">
                    1. File Service Account JSON (Google Cloud)
                  </label>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 bg-fb-surface-hover hover:bg-slate-800 text-fb-text border border-slate-700/60 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs">
                    <span className="material-symbols-outlined text-sm text-fb-blue">upload_file</span>
                    <span>Tải file .json lên</span>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={ztteam_handleFileUpload}
                    />
                  </label>
                </div>

                <div className="relative">
                  <textarea
                    rows={6}
                    value={configCredentialsJson}
                    onChange={(e) => setConfigCredentialsJson(e.target.value)}
                    placeholder='Dán toàn bộ nội dung file Service Account JSON vào đây (vd: { "type": "service_account", "client_email": "..." })'
                    className="w-full bg-black/40 border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-fb-blue focus:ring-1 focus:ring-fb-blue transition-all"
                  />
                </div>

                {configClientEmail && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
                    <span className="material-symbols-outlined text-sm text-blue-400">verified_user</span>
                    <span className="truncate">Email Service Account: <b>{configClientEmail}</b></span>
                  </div>
                )}
                <p className="text-[11px] text-fb-text-muted">
                  💡 Nhớ cấp quyền <b>Viewer</b> cho email Service Account ở trên trong phần <i>Admin &rarr; Property Access Management</i> của từng GA4 Property.
                </p>
              </div>

              {/** 2. Danh sách Website cần theo dõi */}
              <div className="space-y-3 pt-2 border-t border-fb-surface-hover/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-fb-text">
                      2. Danh Sách Website Cần Theo Dõi (Multi-site)
                    </h4>
                    <p className="text-[11px] text-fb-text-muted mt-0.5">
                      Thêm từng mã GA4 Property ID của từng site (vd: thieponline.store, reel.didinao.com, ...)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={ztteam_handleAddSite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Thêm Site</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {configSites.map((siteItem, idx) => (
                    <div
                      key={siteItem.id}
                      className="p-3.5 rounded-xl bg-fb-surface-hover/30 border border-fb-surface-hover/60 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-fb-text">
                          Website #{idx + 1}
                        </span>

                        <div className="flex items-center gap-3">
                          {/** Switch Bật/Tắt theo dõi */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-fb-text-muted">Theo dõi:</span>
                            <button
                              type="button"
                              onClick={() => ztteam_handleUpdateSite(siteItem.id, 'active', !siteItem.active)}
                              className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                                siteItem.active ? 'bg-emerald-500' : 'bg-black/30 shadow-inner border border-white/5'
                              }`}
                            >
                              <span
                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                  siteItem.active ? 'translate-x-4' : 'translate-x-0.5'
                                }`}
                              />
                            </button>
                          </div>

                          {/** Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => ztteam_handleDeleteSite(siteItem.id)}
                            className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Xóa website này"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/** Tên website */}
                        <div>
                          <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1">
                            Tên Website
                          </label>
                          <input
                            type="text"
                            value={siteItem.name}
                            onChange={(e) => ztteam_handleUpdateSite(siteItem.id, 'name', e.target.value)}
                            placeholder="vd: Thiệp Online"
                            className="w-full bg-black/40 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-fb-blue"
                          />
                        </div>

                        {/** Domain */}
                        <div>
                          <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1">
                            Domain / Tên Miền
                          </label>
                          <input
                            type="text"
                            value={siteItem.domain}
                            onChange={(e) => ztteam_handleUpdateSite(siteItem.id, 'domain', e.target.value)}
                            placeholder="vd: thieponline.store"
                            className="w-full bg-black/40 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-fb-blue"
                          />
                        </div>

                        {/** GA4 Property ID */}
                        <div>
                          <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1">
                            GA4 Property ID
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={siteItem.propertyId}
                              onChange={(e) => ztteam_handleUpdateSite(siteItem.id, 'propertyId', e.target.value)}
                              placeholder="vd: 520258342"
                              className="w-full bg-black/40 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:border-fb-blue"
                            />
                            <button
                              type="button"
                              onClick={() => ztteam_handleTestSite(siteItem.id, siteItem.propertyId)}
                              disabled={testingSiteId === siteItem.id}
                              className="px-2.5 py-1.5 bg-fb-surface-hover hover:bg-slate-800 text-fb-text rounded-xl border border-slate-700 text-xs font-bold shrink-0 transition-all cursor-pointer"
                              title="Kiểm tra kết nối"
                            >
                              {testingSiteId === siteItem.id ? (
                                <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span>
                              ) : (
                                <span className="material-symbols-outlined text-xs text-emerald-400">play_arrow</span>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/** Footer Modal */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-fb-surface-hover/50 bg-fb-surface">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={ztteam_handleSaveConfig}
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-fb-blue hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                {isSavingConfig ? (
                  <>
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">save</span>
                    <span>Lưu Cấu Hình</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
