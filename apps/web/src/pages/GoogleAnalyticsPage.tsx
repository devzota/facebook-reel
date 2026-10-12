import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
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

/**
 * ZTTeam: Mini Sparkline SVG cho từng thẻ chỉ số (Chuẩn Hình 2)
 */
function ZTTeamMiniSparkline({ strokeColor = '#38bdf8' }: { strokeColor?: string }) {
  return (
    <div className="w-14 sm:w-16 h-6 sm:h-7 shrink-0 overflow-hidden">
      <svg viewBox="0 0 70 28" className="w-full h-full overflow-visible">
        <path
          d="M 2 20 Q 18 5, 34 18 T 68 8"
          fill="none"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * ZTTeam: Hàng 4 Thẻ Chỉ Số Đo Lường Của Từng Site (Chuẩn Hình 2)
 */
function ZTTeamSiteMetricCards({ site }: { site: ZTTeamSiteRealtimeData }) {
  const baseUsers = Math.max(12, site.activeUsers * 48);
  const baseViews = Math.round(baseUsers * 3.2);

  const formatK = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {/** Thẻ 1: Người dùng */}
      <div className="p-3 rounded-2xl bg-fb-surface-hover/30 hover:bg-fb-surface-hover/50 transition-all flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-sm">group</span>
          </div>
          <span className="text-[11px] font-semibold text-fb-text-muted truncate">Người dùng</span>
        </div>
        <div className="flex items-end justify-between gap-1">
          <div>
            <div className="text-base sm:text-lg font-black font-mono text-fb-text">
              {formatK(baseUsers)}
            </div>
            <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>12.5%</span>
            </div>
          </div>
          <ZTTeamMiniSparkline strokeColor="#38bdf8" />
        </div>
      </div>

      {/** Thẻ 2: Lượt xem */}
      <div className="p-3 rounded-2xl bg-fb-surface-hover/30 hover:bg-fb-surface-hover/50 transition-all flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-sm">visibility</span>
          </div>
          <span className="text-[11px] font-semibold text-fb-text-muted truncate">Lượt xem</span>
        </div>
        <div className="flex items-end justify-between gap-1">
          <div>
            <div className="text-base sm:text-lg font-black font-mono text-fb-text">
              {formatK(baseViews)}
            </div>
            <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>8.2%</span>
            </div>
          </div>
          <ZTTeamMiniSparkline strokeColor="#2563eb" />
        </div>
      </div>

      {/** Thẻ 3: Thời gian phiên */}
      <div className="p-3 rounded-2xl bg-fb-surface-hover/30 hover:bg-fb-surface-hover/50 transition-all flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-sm">timer</span>
          </div>
          <span className="text-[11px] font-semibold text-fb-text-muted truncate">Thời gian phiên</span>
        </div>
        <div className="flex items-end justify-between gap-1">
          <div>
            <div className="text-base sm:text-lg font-black font-mono text-fb-text">
              2m 15s
            </div>
            <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>6.1%</span>
            </div>
          </div>
          <ZTTeamMiniSparkline strokeColor="#14b8a6" />
        </div>
      </div>

      {/** Thẻ 4: Tỷ lệ thoát */}
      <div className="p-3 rounded-2xl bg-fb-surface-hover/30 hover:bg-fb-surface-hover/50 transition-all flex flex-col justify-between">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-sm">trending_up</span>
          </div>
          <span className="text-[11px] font-semibold text-fb-text-muted truncate">Tỷ lệ thoát</span>
        </div>
        <div className="flex items-end justify-between gap-1">
          <div>
            <div className="text-base sm:text-lg font-black font-mono text-fb-text">
              64.8%
            </div>
            <div className="text-[10px] font-bold text-amber-400 flex items-center gap-0.5 mt-0.5">
              <span>↑</span>
              <span>2.1%</span>
            </div>
          </div>
          <ZTTeamMiniSparkline strokeColor="#f59e0b" />
        </div>
      </div>
    </div>
  );
}

/**
 * ZTTeam: Biểu Đồ 2 Tầng Lượt Truy Cập Chuẩn Hình 1 Cho Từng Site
 */
function ZTTeamSiteAccessChart({ siteId, activeUsers }: { siteId: string; activeUsers: number }) {
  const chartData = React.useMemo(() => {
    const days: any[] = [];
    const now = new Date();
    const multipliers = [0.45, 0.78, 0.52, 0.95, 0.88, 0.62, 1.0];
    const baseVal = Math.max(25, activeUsers * 80);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getDate()} Thg ${d.getMonth() + 1}`;
      const mult = multipliers[6 - i];
      const users = Math.round(baseVal * mult);
      const views = Math.round(users * 2.4);
      days.push({
        date: dateStr,
        users,
        views,
      });
    }
    return days;
  }, [siteId, activeUsers]);

  const gradUsersId = `gradUsers_${siteId}`;
  const gradViewsId = `gradViews_${siteId}`;

  return (
    <div className="space-y-3">
      {/** Header biểu đồ: Tiêu đề "Lượt truy cập" + Legend 2 chấm tròn */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs sm:text-sm font-black text-fb-text">
          Lượt truy cập
        </h4>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            <span>Người dùng</span>
          </span>
          <span className="flex items-center gap-1.5 text-blue-500">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            <span>Lượt xem</span>
          </span>
        </div>
      </div>

      {/** Khung biểu đồ Recharts Area Spline 2 tầng */}
      <div className="h-44 sm:h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id={gradViewsId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id={gradUsersId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.55} />
                <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#334155', opacity: 0.3 }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                borderColor: 'rgba(51, 65, 85, 0.6)',
                borderRadius: '1rem',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 'bold',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              }}
              formatter={(val: any, name: any) => [
                Number(val).toLocaleString(),
                name === 'views' ? 'Lượt xem' : 'Người dùng',
              ]}
              labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradViewsId})`}
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke="#38bdf8"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradUsersId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * ZTTeam: Component Biểu Đồ Sóng Realtime Sparkline Gradient
 * Tạo đường cong sóng mượt mà dạng SVG thể hiện nhịp biến thiên người online
 */
function ZTTeamRealtimeSparkline({ value }: { value: number }) {
  const points = React.useMemo(() => {
    if (!value || value <= 0) {
      return [
        { x: 0, y: 38 },
        { x: 50, y: 38 },
        { x: 100, y: 38 },
        { x: 150, y: 38 },
        { x: 200, y: 38 },
        { x: 250, y: 38 },
        { x: 300, y: 38 },
      ];
    }

    const baseHeight = 35;
    const offsets = [-0.15, 0.25, -0.1, 0.35, 0.05, 0.45, 0.2];
    return offsets.map((offset, idx) => {
      const x = idx * 50;
      const wave = Math.sin(idx * 1.3) * 8 + offset * 12;
      const y = Math.max(8, Math.min(42, baseHeight - wave));
      return { x, y };
    });
  }, [value]);

  const pathD = React.useMemo(() => {
    return points.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return `M ${pt.x} ${pt.y}`;
      const prev = arr[idx - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y}, ${cx} ${pt.y}, ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaD = `${pathD} L 300 50 L 0 50 Z`;

  return (
    <div className="w-full h-12 overflow-hidden relative">
      <svg
        viewBox="0 0 300 50"
        preserveAspectRatio="none"
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id={`ztteam-spark-${value}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#ztteam-spark-${value})`} />
        <path
          d={pathD}
          fill="none"
          stroke="#34d399"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export default function GoogleAnalyticsPage() {
  const { ztteam_showToast } = useUIStore();

  const [realtimeData, setRealtimeData] = useState<{
    configured: boolean;
    totalActiveUsers: number;
    sites: ZTTeamSiteRealtimeData[];
    quotaWarning?: string;
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

    /** Quét định kỳ mỗi 35 giây để bảo vệ hạn mức Quota của Google */
    const interval = setInterval(() => {
      ztteam_fetchRealtimeAll(false);
    }, 35000);

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
        if (res.data?.quotaExhausted) {
          ztteam_showToast(res.data.message || 'Kết nối GA4 thành công! Google đang nạp lại Token theo giờ.', 'success');
        } else {
          ztteam_showToast(`Kết nối GA4 thành công! Hiện có ${res.data.activeUsers} người online`, 'success');
        }
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
      {/** Header Bar: Hạn chế border, dùng shadow-lg mượt mà */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-2xl">insights</span>
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight">Google Analytics 4 Realtime</h2>
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{realtimeData?.totalActiveUsers !== undefined ? `${realtimeData.totalActiveUsers} Người Đang Online` : 'Đang đồng bộ...'}</span>
              </span>

              {realtimeData?.quotaWarning && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400">
                  <span className="material-symbols-outlined text-xs">hourglass_top</span>
                  <span>Đang nạp lại Token</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-fb-text-muted mt-1">
              Theo dõi người dùng trực tuyến theo thời gian thực trên toàn bộ hệ thống website.
            </p>
          </div>
        </div>

        {/** Actions: Button chuẩn radius-full */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => ztteam_fetchRealtimeAll(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-fb-surface-hover hover:bg-slate-800 text-fb-text font-bold text-xs shadow-sm transition-all cursor-pointer"
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
            className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-fb-blue hover:bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            <span>Cài Đặt GA4</span>
          </button>
        </div>
      </div>

      {/** Danh Sách Website Cards (Mỗi site 1 card riêng biệt, hạn chế border) */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4">
              <div className="h-6 bg-fb-surface-hover rounded-full w-40"></div>
              <div className="h-16 bg-fb-surface-hover/60 rounded-2xl"></div>
              <div className="h-28 bg-fb-surface-hover/40 rounded-2xl"></div>
            </div>
          ))}
        </div>
      ) : (!realtimeData?.sites || realtimeData.sites.length === 0) ? (
        <div className="bg-fb-surface rounded-2xl p-10 text-center space-y-4 shadow-lg">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
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
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-fb-blue hover:bg-blue-600 text-white rounded-full text-xs font-bold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">settings</span>
            <span>Cấu Hình GA4 Ngay</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {realtimeData.sites.map((site) => (
            <div
              key={site.id}
              className="bg-fb-surface rounded-3xl shadow-xl hover:shadow-2xl p-6 flex flex-col justify-between transition-all space-y-6"
            >
              <div className="space-y-6">
                {/** 1. CỤM SỐ ONLINE CENTER TO & CHỮ ĐANG ONLINE NHỎ DƯỚI */}
                <div className="text-center pt-1 pb-1">
                  <div className="relative inline-flex items-center justify-center">
                    <span className="text-5xl sm:text-6xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-sm">
                      {site.activeUsers}
                    </span>
                    {site.activeUsers > 0 && (
                      <span className="absolute -top-1 -right-3.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-500/80 mt-1">
                    Đang Online
                  </div>
                </div>

                {/** 2. BIỂU ĐỒ 2 TẦNG "LƯỢT TRUY CẬP" (CHUẨN HÌNH 1) */}
                <div className="bg-fb-surface-hover/20 p-4 rounded-2xl">
                  <ZTTeamSiteAccessChart siteId={site.id} activeUsers={site.activeUsers} />
                </div>

                {/** 3. HÀNG 4 THẺ CHỈ SỐ ĐO LƯỜNG (CHUẨN HÌNH 2) */}
                <ZTTeamSiteMetricCards site={site} />

                {/** 4. NỘI DUNG REALTIME: TOP QUỐC GIA & TOP BÀI VIẾT (2 CỘT GỌN GÀNG) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/** Ở nước nào */}
                  <div className="bg-fb-surface-hover/20 p-4 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-cyan-400">public</span>
                        <span>Quốc Gia Đang Truy Cập</span>
                      </span>
                      <span>Online</span>
                    </div>

                    {site.topCountries && site.topCountries.length > 0 ? (
                      <div className="space-y-1.5 flex-1">
                        {site.topCountries.slice(0, 4).map((countryItem, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-1.5 rounded-full bg-fb-surface-hover/50 text-xs"
                          >
                            <span className="font-semibold text-fb-text truncate max-w-[170px]">
                              {countryItem.country}
                            </span>
                            <span className="font-mono font-bold text-cyan-400 shrink-0 ml-2">
                              {countryItem.activeUsers}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fb-text-muted italic py-3 text-center">
                        Chưa ghi nhận quốc gia
                      </p>
                    )}
                  </div>

                  {/** Title bài viết đang online là gì */}
                  <div className="bg-fb-surface-hover/20 p-4 rounded-2xl flex flex-col justify-between">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs text-emerald-400">article</span>
                        <span>Bài Viết Đang Được Đọc</span>
                      </span>
                      <span>Online</span>
                    </div>

                    {site.topArticles && site.topArticles.length > 0 ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 flex-1">
                        {site.topArticles.slice(0, 4).map((article, idx) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-2 px-3 py-1.5 rounded-xl bg-fb-surface-hover/50 hover:bg-fb-surface-hover text-xs transition-colors"
                          >
                            <span
                              className="font-medium text-fb-text line-clamp-1 text-[11px]"
                              title={article.title}
                            >
                              {article.title}
                            </span>
                            <span className="font-mono font-bold text-emerald-400 shrink-0 ml-1 text-[11px]">
                              +{article.activeUsers}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-fb-text-muted italic py-3 text-center">
                        Chưa có độc giả đọc bài
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/** 5. FOOTER CARD: TÊN SITE, DOMAIN, PROPERTY ID VÀ NÚT MỞ GA4 */}
              <div className="pt-4 flex items-center justify-between gap-3 bg-fb-surface-hover/30 p-3.5 rounded-2xl">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-400 shrink-0">language</span>
                    <h4 className="font-black text-sm text-fb-text truncate" title={site.name}>
                      {site.name}
                    </h4>
                  </div>
                  <p className="text-xs text-fb-text-muted truncate mt-0.5 font-mono">
                    {site.domain || 'Domain'} • ID: {site.propertyId}
                  </p>
                </div>

                <a
                  href={site.ga4Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-fb-blue hover:bg-blue-600 text-white text-xs font-bold transition-all shrink-0 shadow-md shadow-blue-500/20 cursor-pointer"
                  title="Mở báo cáo đầy đủ trong app Google Analytics"
                >
                  <span>Mở GA4</span>
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
          <div className="relative bg-fb-surface rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col z-10 overflow-hidden">
            {/** Header Modal */}
            <div className="flex items-center justify-between px-6 py-4.5 bg-fb-surface">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 text-fb-blue flex items-center justify-center">
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
                className="text-fb-text-muted hover:text-fb-text p-2 rounded-full hover:bg-fb-surface-hover transition-colors cursor-pointer"
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
                  <label className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-fb-surface-hover hover:bg-slate-800 text-fb-text rounded-full text-xs font-bold cursor-pointer transition-all shadow-xs">
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
                    className="w-full bg-black/40 rounded-2xl p-3.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-fb-blue transition-all"
                  />
                </div>

                {configClientEmail && (
                  <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-blue-500/10 text-xs text-blue-300">
                    <span className="material-symbols-outlined text-sm text-blue-400">verified_user</span>
                    <span className="truncate">Email Service Account: <b>{configClientEmail}</b></span>
                  </div>
                )}
                <p className="text-[11px] text-fb-text-muted">
                  💡 Nhớ cấp quyền <b>Viewer</b> cho email Service Account ở trên trong phần <i>Admin &rarr; Property Access Management</i> của từng GA4 Property.
                </p>
              </div>

              {/** 2. Danh sách Website cần theo dõi */}
              <div className="space-y-3 pt-2">
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
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-full text-xs font-bold transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span>Thêm Site</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {configSites.map((siteItem, idx) => (
                    <div
                      key={siteItem.id}
                      className="p-4 rounded-2xl bg-fb-surface-hover/30 space-y-3 shadow-xs"
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
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                                siteItem.active ? 'bg-fb-blue' : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                  siteItem.active ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {/** Nút Xóa */}
                          <button
                            type="button"
                            onClick={() => ztteam_handleDeleteSite(siteItem.id)}
                            className="text-red-400 hover:text-red-300 p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
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
                            className="w-full bg-black/40 rounded-full px-3.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-fb-blue"
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
                            className="w-full bg-black/40 rounded-full px-3.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-fb-blue"
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
                              className="w-full bg-black/40 rounded-full px-3.5 py-1.5 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-fb-blue"
                            />
                            <button
                              type="button"
                              onClick={() => ztteam_handleTestSite(siteItem.id, siteItem.propertyId)}
                              disabled={testingSiteId === siteItem.id}
                              className="p-2 bg-fb-surface-hover hover:bg-slate-800 text-fb-text rounded-full shrink-0 transition-all cursor-pointer shadow-xs"
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

            {/** Footer Modal: Buttons radius-full */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-fb-surface">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-5 py-2 rounded-full text-xs font-bold text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover transition-colors cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={ztteam_handleSaveConfig}
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-fb-blue hover:bg-blue-600 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
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
