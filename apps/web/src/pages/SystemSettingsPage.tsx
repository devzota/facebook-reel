import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { useZTTeamFacebookStore } from '../stores/facebookStore';
import CustomDropdown from '../components/CustomDropdown';

export default function SystemSettingsPage() {
  const { ztteam_showToast } = useUIStore();
  const { pages, ztteam_fetchPagesFromDB } = useZTTeamFacebookStore();

  const [settings, setSettings] = useState({
    openai_api_key: '',
    deepseek_api_key: '',
    gemini_api_key: '',
    active_ai_provider: 'openai',
    remotion_license: '',
    max_concurrent_jobs: '2',
    video_retention_days: '7',
    telegram_bot_token: '',
    telegram_chat_id: '',
    youtube_cookies: '',
    elevenlabs_api_key: '',
    notify_publish_success: true,
    notify_publish_error: true,
    notify_crawl_success: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [ztteam_isTestingTelegram, setZtteam_isTestingTelegram] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('settings');
        setSettings(prev => ({ ...prev, ...res.data }));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
    ztteam_fetchPagesFromDB();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put('settings', settings);
      ztteam_showToast('Đã lưu cấu hình thành công!', 'success');
    } catch (e) {
      ztteam_showToast('Lỗi khi lưu cấu hình', 'error');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setSettings(prev => ({ ...prev, [e.target.name]: value }));
  };

  const ztteam_handleTestTelegram = async () => {
    if (!settings.telegram_bot_token || !settings.telegram_chat_id) {
      ztteam_showToast('Vui lòng nhập đầy đủ Telegram Bot Token và Chat ID', 'warning');
      return;
    }
    try {
      setZtteam_isTestingTelegram(true);
      const res = await api.post('telegram/test', {
        token: settings.telegram_bot_token,
        chatId: settings.telegram_chat_id
      });
      if (res.data?.success) {
        ztteam_showToast('Gửi tin nhắn thử nghiệm Telegram thành công!', 'success');
      } else {
        ztteam_showToast(res.data?.message || 'Không thể kết nối đến Telegram', 'error');
      }
    } catch (e: any) {
      ztteam_showToast(e.response?.data?.message || e.message || 'Lỗi khi kiểm tra kết nối Telegram', 'error');
    } finally {
      setZtteam_isTestingTelegram(false);
    }
  };

  const activePages = pages.filter(p => p.isActive !== false);

  if (isLoading) return <div className="p-8 text-fb-text-muted">Đang tải...</div>;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight">Cài Đặt Hệ Thống</h2>
          <p className="text-sm font-medium text-fb-text-muted mt-1">Quản lý kết nối Facebook API, Khóa AI Engine và cấu hình đăng bài.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 disabled:opacity-50 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-lg shrink-0">save</span>
          <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          
          {/* Section 1: Facebook Page Connections */}
          <div className="bg-gradient-to-br from-fb-surface via-fb-surface to-blue-950/30 p-5 rounded-2xl shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
                  <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                    <span className="material-symbols-outlined text-xl">hub</span>
                  </div>
                  <span>Trang Đã Kết Nối</span>
                </h3>
                <p className="text-xs font-medium text-fb-text-muted mt-0.5">Quản lý quyền tự động đăng Reels và bài viết lên Fanpage.</p>
              </div>
              <button className="bg-gradient-to-r from-fb-blue to-cyan-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-md shadow-blue-500/20 hover:opacity-90 transition-colors">
                + Thêm Trang Mới
              </button>
            </div>

            <div className="space-y-3">
              {activePages.length > 0 ? activePages.map(page => {
                const initials = page.name ? page.name.substring(0, 2).toUpperCase() : 'FB';
                return (
                  <div key={page.id} className="p-4 bg-fb-surface-hover rounded-2xl flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      {page.avatar ? (
                        <img src={page.avatar} alt={page.name} className="w-10 h-10 shrink-0 rounded-xl object-cover shadow-md shadow-blue-500/10" />
                      ) : (
                        <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-fb-blue text-white font-black flex items-center justify-center shadow-md shadow-blue-500/30">
                          {initials}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-fb-text">{page.name}</h4>
                        <p className="text-xs text-blue-400 font-bold">ID: {page.id} {page.followersCount ? `• ${page.followersCount} Follower` : ''}</p>
                      </div>
                    </div>
                    <span className="px-2.5 sm:px-3.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] sm:text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
                      Đã kết nối
                    </span>
                  </div>
                );
              }) : (
                <div className="p-4 bg-fb-surface-hover rounded-2xl text-center text-sm text-fb-text-muted font-medium">
                  Chưa có trang nào được kết nối.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: AI Engine API Key Settings */}
          <div className="bg-gradient-to-br from-fb-surface via-fb-surface to-cyan-950/30 p-5 rounded-2xl shadow-lg space-y-4">
            <div>
              <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
                <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                  <span className="material-symbols-outlined text-xl">key</span>
                </div>
                <span>Cấu Hình Khóa AI Engine API</span>
              </h3>
              <p className="text-xs font-medium text-fb-text-muted mt-0.5">Dùng để tự động tạo kịch bản, giọng đọc Voiceover và render Reels.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-cyan-400 mb-1.5">Mô Hình AI Xử Lý Chính</label>
                <CustomDropdown
                  value={settings.active_ai_provider || 'openai'}
                  onChange={(val) => setSettings(prev => ({ ...prev, active_ai_provider: val }))}
                  options={[
                    { value: 'openai', label: 'OpenAI (GPT-4)' },
                    { value: 'gemini', label: 'Google Gemini' },
                    { value: 'deepseek', label: 'DeepSeek AI' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-400 mb-1.5">Google Gemini API Key (Khuyên dùng - Tiết kiệm chi phí)</label>
                <input 
                  type="password" 
                  name="gemini_api_key"
                  value={settings.gemini_api_key || ''}
                  onChange={handleChange}
                  placeholder="AIzaSy..."
                  className="w-full p-3 bg-fb-surface-hover text-fb-text rounded-full text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-amber-400 px-4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-cyan-400 mb-1.5">OpenAI API Key</label>
                <input 
                  type="password" 
                  name="openai_api_key"
                  value={settings.openai_api_key || ''}
                  onChange={handleChange}
                  placeholder="sk-..."
                  className="w-full p-3 bg-fb-surface-hover text-fb-text rounded-full text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-cyan-400 px-4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-400 mb-1.5">DeepSeek API Key</label>
                <input 
                  type="password" 
                  name="deepseek_api_key"
                  value={settings.deepseek_api_key || ''}
                  onChange={handleChange}
                  placeholder="sk-..."
                  className="w-full p-3 bg-fb-surface-hover text-fb-text rounded-full text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-emerald-400 px-4"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-blue-400 mb-1.5">ElevenLabs Voiceover Key (Tùy chọn)</label>
                <input 
                  type="password" 
                  name="elevenlabs_api_key"
                  value={settings.elevenlabs_api_key || ''}
                  onChange={handleChange}
                  placeholder="Nhập ElevenLabs Key nếu muốn dùng giọng đọc tùy chỉnh..." 
                  className="w-full p-3 bg-fb-surface-hover text-fb-text placeholder:text-fb-text-muted rounded-full text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-blue-400 px-4"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div className="space-y-6">
          
          {/* Section 3: Notification Preferences */}
          <div className="bg-fb-surface p-5 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                <span className="material-symbols-outlined text-xl">notifications_active</span>
              </div>
              <span>Cấu Hình Thông Báo</span>
            </h3>

            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 bg-fb-surface-hover/50 rounded-2xl cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-fb-text">Thông báo khi bài đăng xuất bản thành công</p>
                  <p className="text-[11px] text-fb-text-muted mt-0.5">Nhận thông báo qua Telegram khi hệ thống đăng bài xong.</p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="notify_publish_success" checked={settings.notify_publish_success !== false} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-fb-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </div>
              </label>

              <label className="flex items-center justify-between p-3.5 bg-fb-surface-hover/50 rounded-2xl cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-fb-text">Thông báo lỗi Crawler / Render AI</p>
                  <p className="text-[11px] text-fb-text-muted mt-0.5">Cảnh báo ngay lập tức nếu tiến trình tự động hóa bị lỗi.</p>
                </div>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" name="notify_publish_error" checked={settings.notify_publish_error !== false} onChange={handleChange} className="sr-only peer" />
                  <div className="w-9 h-5 bg-fb-surface-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                </div>
              </label>
            </div>
            
            <div className="pt-4 border-t border-fb-surface-hover space-y-3">
              <div>
                <label className="block text-xs font-bold text-fb-text mb-1.5">Telegram Bot Token</label>
                <input 
                  type="text" 
                  name="telegram_bot_token"
                  value={settings.telegram_bot_token || ''}
                  onChange={handleChange}
                  placeholder="123456789:ABCDefgh..." 
                  className="w-full p-3 bg-fb-surface-hover text-fb-text placeholder:text-fb-text-muted rounded-xl text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text mb-1.5">Telegram Chat ID</label>
                <input 
                  type="text" 
                  name="telegram_chat_id"
                  value={settings.telegram_chat_id || ''}
                  onChange={handleChange}
                  placeholder="-100123456789" 
                  className="w-full p-3 bg-fb-surface-hover text-fb-text placeholder:text-fb-text-muted rounded-xl text-xs font-medium border-none focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <button
                type="button"
                onClick={ztteam_handleTestTelegram}
                disabled={ztteam_isTestingTelegram}
                className="w-full mt-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">send</span>
                <span>{ztteam_isTestingTelegram ? 'Đang kiểm tra kết nối...' : 'Kiểm Tra Kết Nối Telegram'}</span>
              </button>
            </div>
          </div>

          {/* Section 4: System Parameters */}
          <div className="bg-fb-surface p-5 rounded-2xl shadow-lg space-y-4">
            <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                <span className="material-symbols-outlined text-xl">settings_system_daydream</span>
              </div>
              <span>Tham Số Hệ Thống</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-fb-text mb-1.5">Giới hạn Render AI đồng thời</label>
                <CustomDropdown
                  value={settings.max_concurrent_jobs || '2'}
                  onChange={(val) => setSettings(prev => ({ ...prev, max_concurrent_jobs: val }))}
                  options={[
                    { value: '1', label: '1 Tiến trình' },
                    { value: '2', label: '2 Tiến trình (Khuyên dùng)' },
                    { value: '4', label: '4 Tiến trình (Cần Server mạnh)' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text mb-1.5">Tự động xóa Video/Ảnh sau</label>
                <CustomDropdown
                  value={settings.video_retention_days || '7'}
                  onChange={(val) => setSettings(prev => ({ ...prev, video_retention_days: val }))}
                  options={[
                    { value: '3', label: '3 Ngày' },
                    { value: '7', label: '7 Ngày' },
                    { value: '30', label: '30 Ngày' },
                    { value: '0', label: 'Không bao giờ xóa' }
                  ]}
                />
                <p className="text-[11px] text-fb-text-muted mt-1">Giúp giải phóng dung lượng ổ cứng cho Server.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
