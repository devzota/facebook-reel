import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useWordpressStore } from '../stores/wordpressStore';
import { useUIStore } from '../stores/uiStore';
import { useZTTeamFacebookStore } from '../stores/facebookStore';
import CustomDropdown from '../components/CustomDropdown';
import ZTTeamAIPostCard from '../components/AIPostCard';

export default function FacebookPageSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();
  const { sites, ztteam_fetchSites, ztteam_fetchCategories, ztteam_fetchTags } = useWordpressStore();
  const { pages, ztteam_fetchPagesFromDB } = useZTTeamFacebookStore();

  /** Main 2-Tab Navigation State */
  const [activeTab, setActiveTab] = useState<number>(() => {
    const hashMatch = window.location.hash.match(/tab=(\d+)/);
    return hashMatch ? parseInt(hashMatch[1], 10) : 1;
  });

  useEffect(() => {
    window.history.replaceState(null, '', `#tab=${activeTab}`);
  }, [activeTab]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  /** Fanpage Info State */
  const [pageName, setPageName] = useState('');
  const [fbPageId, setFbPageId] = useState('');
  const [pageAvatar, setPageAvatar] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  /** Publishing & Schedule Config State */
  const [postFormat, setPostFormat] = useState('image');
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(true);
  const [addLinkToCaption, setAddLinkToCaption] = useState(false);
  const [addLinkToComment, setAddLinkToComment] = useState(false);
  const [scheduleMode, setScheduleMode] = useState('fixed');
  const [scheduleFixedTimes, setScheduleFixedTimes] = useState<string[]>([]);
  const [timeInput, setTimeInput] = useState('');
  const [scheduleImmediateGap, setScheduleImmediateGap] = useState(60);

  /** Auto Crawl & AI Generation Config State */
  const [autoCreateEnabled, setAutoCreateEnabled] = useState(false);
  const [autoScanInterval, setAutoScanInterval] = useState(2);
  const [autoScanBatchSize, setAutoScanBatchSize] = useState(1);
  const [autoQueueLimit, setAutoQueueLimit] = useState(3);
  const [autoMaxPostAgeDays, setAutoMaxPostAgeDays] = useState(1);

  /** Sources State */
  const [sources, setSources] = useState<any[]>([]);
  const [sourceCategoriesCache, setSourceCategoriesCache] = useState<Record<string, any[]>>({});
  const [sourceTagsCache, setSourceTagsCache] = useState<Record<string, any[]>>({});

  /** Scheduler Timers */
  const [lastRenderTime, setLastRenderTime] = useState<string | null>(null);
  const [nextRenderTime, setNextRenderTime] = useState<string | null>(null);
  const [lastPublishTime, setLastPublishTime] = useState<string | null>(null);
  const [nextPublishTime, setNextPublishTime] = useState<string | null>(null);

  /** Queue & History State */
  const [queueTab, setQueueTab] = useState<'image' | 'video'>('image');
  const [imagesQueue, setImagesQueue] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);
  const [isPosting, setIsPosting] = useState<Record<string, boolean>>({});

  /** Manual Create Modal State */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manualCreateFormat, setManualCreateFormat] = useState<'image' | 'video'>('image');
  const [createSiteId, setCreateSiteId] = useState('');
  const [createPosts, setCreatePosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [createPostId, setCreatePostId] = useState('');
  const [createPostTitle, setCreatePostTitle] = useState('');
  const [isCreatingQueueItem, setIsCreatingQueueItem] = useState(false);

  /** Initial Fetch */
  useEffect(() => {
    ztteam_fetchSites();
    ztteam_fetchSettings();
    api.get('facebook/pages').then(res => {
      const allTags = new Set<string>();
      if (res.data && Array.isArray(res.data)) {
        res.data.forEach((p: any) => {
          if (p.tags && Array.isArray(p.tags)) {
            p.tags.forEach((t: string) => allTags.add(t));
          }
        });
      }
      setAvailableTags(Array.from(allTags));
    }).catch(console.error);

    if (pages.length === 0) {
      ztteam_fetchPagesFromDB();
    }
  }, [id]);

  /** Load Queue on Tab 2 or format switch */
  useEffect(() => {
    if (activeTab === 2) {
      ztteam_loadQueue();
    }
  }, [activeTab, id, queueTab]);

  /** SSE Live Updates for Tab 2 */
  useEffect(() => {
    if (activeTab !== 2) return;

    const sseImage = new EventSource('/api/image/events');
    sseImage.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setImagesQueue(prev => {
          const exists = prev.find(r => r.id === payload.id);
          if (exists) {
            return prev.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          }
          return [payload, ...prev];
        });
      } catch (err) { }
    };

    const sseReel = new EventSource('/api/render/events');
    sseReel.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setReels(prev => {
          const exists = prev.find(r => r.id === payload.id);
          if (exists) {
            return prev.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          }
          return [payload, ...prev];
        });
      } catch (err) { }
    };

    const pollInterval = setInterval(() => {
      if (activeTab === 2) {
        ztteam_loadQueue(true);
      }
    }, 4000);

    return () => {
      sseImage.close();
      sseReel.close();
      clearInterval(pollInterval);
    };
  }, [activeTab]);

  /** Fetch Page Settings */
  const ztteam_fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.get(`facebook/pages/${id}/settings?_t=${Date.now()}`);
      const data = res.data;
      setPageName(data.name || 'Fanpage Settings');
      setFbPageId(data.fb_page_id || '');
      setPageAvatar(data.avatar || null);
      setTags(data.tags || []);
      setPostFormat(data.post_format || 'image');
      setAutoPublishEnabled(data.auto_publish_enabled !== undefined ? data.auto_publish_enabled : true);
      setAddLinkToCaption(data.add_link_to_caption || false);
      setAddLinkToComment(data.add_link_to_comment || false);
      setScheduleMode(data.schedule_mode || 'fixed');
      setScheduleFixedTimes(data.schedule_fixed_times || []);
      setScheduleImmediateGap(data.schedule_immediate_gap_minutes || 60);

      setAutoCreateEnabled(data.auto_create_enabled || false);
      setAutoScanInterval(data.auto_scan_interval_hours || 2);
      setAutoScanBatchSize(data.auto_scan_batch_size || 1);
      setAutoQueueLimit(data.auto_queue_limit || 3);
      setAutoMaxPostAgeDays(data.auto_max_post_age_days || 1);

      setLastRenderTime(data.last_render_time || null);
      setNextRenderTime(data.next_render_time || null);
      setLastPublishTime(data.last_publish_time || null);
      setNextPublishTime(data.next_publish_time || null);

      setSources(data.sources || []);

      if (data.sources) {
        data.sources.forEach((s: any) => {
          if (s.target_site_id && !sourceCategoriesCache[s.target_site_id]) {
            ztteam_loadCategories(s.target_site_id);
          }
          if (s.target_site_id && !sourceTagsCache[s.target_site_id]) {
            ztteam_loadTags(s.target_site_id);
          }
        });
      }
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi tải cấu hình', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const ztteam_loadCategories = async (siteId: string) => {
    try {
      const cats = await ztteam_fetchCategories(siteId);
      setSourceCategoriesCache(prev => ({ ...prev, [siteId]: cats }));
    } catch (e) {
      console.error(e);
    }
  };

  const ztteam_loadTags = async (siteId: string) => {
    try {
      const tagsData = await ztteam_fetchTags(siteId);
      setSourceTagsCache(prev => ({ ...prev, [siteId]: tagsData }));
    } catch (e) {
      console.error(e);
    }
  };

  /** Fetch Queue Data */
  const ztteam_loadQueue = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoadingQueue(true);
      const [imgRes, reelRes] = await Promise.all([
        api.get(`image/list?fbPageId=${id}&limit=30&_t=${Date.now()}`),
        api.get(`render/list?fbPageId=${id}&limit=30&_t=${Date.now()}`)
      ]);
      setImagesQueue(imgRes.data?.data || []);
      setReels(reelRes.data?.reels || []);
    } catch (error: any) {
      if (!isSilent) ztteam_showToast('Lỗi tải danh sách hàng đợi', 'error');
    } finally {
      if (!isSilent) setIsLoadingQueue(false);
    }
  };

  /** Save Settings */
  const ztteam_handleSave = async () => {
    try {
      setIsSaving(true);
      await api.put(`facebook/pages/${id}/settings`, {
        tags,
        post_format: postFormat,
        auto_publish_enabled: autoPublishEnabled,
        add_link_to_caption: addLinkToCaption,
        add_link_to_comment: addLinkToComment,
        schedule_mode: scheduleMode,
        schedule_fixed_times: scheduleFixedTimes,
        schedule_immediate_gap_minutes: scheduleImmediateGap,
        auto_create_enabled: false,
        sources
      });
      ztteam_showToast('Đã lưu cấu hình thành công', 'success');
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi lưu cấu hình', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  /** Tag & Time Handlers */
  const ztteam_addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const ztteam_addTime = () => {
    if (timeInput.trim() && !scheduleFixedTimes.includes(timeInput.trim())) {
      setScheduleFixedTimes([...scheduleFixedTimes, timeInput.trim()]);
      setTimeInput('');
    }
  };

  /** Cross-page fixed time duplicate detection */
  const usedTimes = new Set<string>();
  pages.forEach(p => {
    if (p.id !== id && p.scheduleFixedTimes) {
      p.scheduleFixedTimes.forEach((t: string) => usedTimes.add(t));
    }
  });

  const predefinedSchedules = [
    { label: 'Khung 1 (08h, 16h, 00h)', times: ['08:00', '16:00', '00:00'] },
    { label: 'Khung 2 (09h, 17h, 01h)', times: ['09:00', '17:00', '01:00'] },
    { label: 'Khung 3 (10h, 18h, 02h)', times: ['10:00', '18:00', '02:00'] },
    { label: 'Khung 4 (11h, 19h, 03h)', times: ['11:00', '19:00', '03:00'] },
    { label: 'Khung 5 (06h, 14h, 22h)', times: ['06:00', '14:00', '22:00'] },
    { label: 'Khung 6 (07h, 15h, 23h)', times: ['07:00', '15:00', '23:00'] },
  ];

  /** Publish Item Immediately */
  const ztteam_publishNow = async (item: any, type: 'image' | 'video') => {
    const confirmed = await ztteam_showConfirm('Xác nhận đăng bài', `Đăng ngay nội dung "${item.wp_post_title || 'bài viết'}" lên Fanpage?`);
    if (!confirmed) return;
    try {
      setIsPosting(prev => ({ ...prev, [item.id]: true }));
      if (type === 'image') {
        await api.post(`image/${item.id}/post-to-fb`);
      } else {
        const res = await api.post(`render/post/${item.id}`);
        if (res.data?.error) throw new Error(res.data.error);
      }
      ztteam_showToast('Đã đăng bài lên Fanpage thành công!', 'success');
      ztteam_loadQueue(true);
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || error.message || 'Lỗi đăng bài lên Fanpage', 'error');
    } finally {
      setIsPosting(prev => ({ ...prev, [item.id]: false }));
    }
  };

  /** Retry Item */
  const ztteam_retryQueueItem = async (item: any, type: 'image' | 'video') => {
    try {
      if (type === 'image') {
        await api.post(`image/retry/${item.id}`);
      } else {
        await api.post(`render/retry/${item.id}`);
      }
      ztteam_showToast('Đã thêm lại vào hàng đợi', 'success');
      ztteam_loadQueue();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi thử lại', 'error');
    }
  };

  /** Delete Item */
  const ztteam_deleteQueueItem = async (item: any, type: 'image' | 'video') => {
    const confirmed = await ztteam_showConfirm('Xác nhận xóa', 'Xóa mục này khỏi hàng đợi? Hành động không thể hoàn tác.');
    if (!confirmed) return;
    try {
      if (type === 'image') {
        await api.delete(`image/${item.id}`);
      } else {
        await api.post(`render/delete/${item.id}`);
      }
      ztteam_showToast('Đã xóa thành công', 'success');
      ztteam_loadQueue();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi xóa', 'error');
    }
  };

  /** Manual Create Item */
  const ztteam_handleManualCreate = async () => {
    if (!createSiteId || !createPostId) {
      ztteam_showToast('Vui lòng chọn nguồn và bài viết', 'error');
      return;
    }

    try {
      setIsCreatingQueueItem(true);
      const selectedPost = createPosts.find(p => String(p.id) === String(createPostId));
      const apiEndpoint = manualCreateFormat === 'image' ? 'image/create' : 'render/create';

      const res = await api.post(apiEndpoint, {
        pageId: id,
        wpPostId: String(createPostId),
        wpPostTitle: createPostTitle,
        wpPostUrl: selectedPost ? selectedPost.link : undefined,
        templateId: 'auto'
      });

      if (res.data && res.data.error) {
        throw new Error(res.data.error);
      }
      ztteam_showToast(`Đã thêm lệnh tạo ${manualCreateFormat === 'image' ? 'Ảnh' : 'Reel'} vào hàng đợi`, 'success');
      setShowCreateModal(false);
      setCreatePostId('');
      setCreatePostTitle('');
      ztteam_loadQueue();
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.error || err.response?.data?.message || err.message || 'Lỗi khởi tạo', 'error');
    } finally {
      setIsCreatingQueueItem(false);
    }
  };

  /** Fetch Posts when Create Site changes */
  useEffect(() => {
    if (createSiteId) {
      setIsLoadingPosts(true);
      const sourceConfig = sources.find(s => s.target_site_id === createSiteId);
      const params = new URLSearchParams();
      if (sourceConfig?.target_category_id) params.append('categoryId', sourceConfig.target_category_id);
      if (sourceConfig?.target_tags) params.append('targetTags', sourceConfig.target_tags);
      const qs = params.toString();

      api.get(`wordpress/sites/${createSiteId}/posts${qs ? '?' + qs : ''}`)
        .then(res => {
          setCreatePosts(res.data || []);
          if (res.data && res.data.length > 0) {
            setCreatePostId(res.data[0].id);
            setCreatePostTitle(res.data[0].title);
          }
        })
        .catch(err => {
          ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi tải danh sách bài viết', 'error');
          setCreatePosts([]);
        })
        .finally(() => setIsLoadingPosts(false));
    } else {
      setCreatePosts([]);
      setCreatePostId('');
      setCreatePostTitle('');
    }
  }, [createSiteId]);

  /** Status Badge Helper */
  const ztteam_getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; border: string; label: string; pulse?: boolean }> = {
      QUEUED: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Đang chờ' },
      RENDERING: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/20', label: 'Đang xử lý AI', pulse: true },
      PROCESSING: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/20', label: 'Đang tạo ảnh', pulse: true },
      COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Sẵn sàng đăng' },
      FAILED: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Thất bại' },
      POSTED: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Đã xuất bản' },
    };
    const s = map[status] || { bg: 'bg-fb-surface-hover', text: 'text-fb-text-muted', border: 'border-white/5', label: status };
    return (
      <span className={`${s.bg} ${s.text} ${s.border} border text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs`}>
        {s.pulse && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>}
        {s.label}
      </span>
    );
  };

  const ztteam_formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center flex flex-col items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-fb-blue mb-3">sync</span>
        <span className="text-sm font-bold text-fb-text-muted">Đang tải cấu hình Fanpage...</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/** Top Header Banner */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-fb-surface-hover/50">
        <div className="flex items-center gap-4">
          {pageAvatar ? (
            <img src={pageAvatar} alt={pageName} className="w-14 h-14 rounded-full object-cover shadow-lg shadow-blue-500/20 shrink-0 border-2 border-fb-blue" />
          ) : (
            <div className="w-14 h-14 bg-gradient-to-br from-fb-blue to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-2xl shrink-0">
              {pageName ? pageName.charAt(0) : 'F'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => navigate('/facebook')} className="text-fb-text-muted hover:text-fb-blue flex items-center gap-1 text-xs font-bold transition-colors">
                <span className="material-symbols-outlined text-[14px]">arrow_back</span> Quay lại danh sách
              </button>
            </div>
            <h3 className="text-2xl font-black text-fb-text tracking-tight flex items-center gap-3">
              {pageName}
              {fbPageId && (
                <a href={`https://facebook.com/${fbPageId}`} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 bg-fb-blue/10 text-fb-blue border border-fb-blue/20 rounded-full hover:bg-fb-blue/20 flex items-center gap-1 font-semibold transition-colors">
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span> Xem Fanpage
                </a>
              )}
            </h3>
            <p className="text-xs text-fb-text-muted mt-1">ID: {fbPageId}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 self-start md:self-auto w-full md:w-auto">
          {/** Tags */}
          <div className="flex items-center gap-2 bg-fb-surface-hover/30 px-3 py-1.5 rounded-xl border border-fb-surface-hover/50 w-full sm:w-auto">
            <span className="material-symbols-outlined text-[16px] text-fb-text-muted">label</span>
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ztteam_addTag()}
              placeholder="Thêm tag..."
              list="available-tags"
              className="w-24 bg-transparent border-none focus:ring-0 text-xs outline-none text-fb-text"
            />
            <datalist id="available-tags">{availableTags.map(t => <option key={t} value={t} />)}</datalist>
            <div className="flex flex-wrap gap-1 ml-2">
              {tags.map(t => (
                <span key={t} className="px-2 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-full text-[10px] font-bold flex items-center gap-1">
                  {t}
                  <span onClick={() => setTags(tags.filter(x => x !== t))} className="material-symbols-outlined text-[12px] cursor-pointer hover:text-rose-400">close</span>
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={ztteam_handleSave}
            disabled={isSaving}
            className="px-6 py-2.5 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm whitespace-nowrap w-full sm:w-auto"
          >
            {isSaving ? <span className="material-symbols-outlined animate-spin text-[20px]">sync</span> : <span className="material-symbols-outlined text-[20px]">save</span>}
            Lưu Thay Đổi
          </button>
        </div>
      </div>

      {/** Clean 2-Tab Navigation Bar */}
      <div className="flex border-b border-fb-surface-hover/60 bg-fb-surface px-4 pt-2 rounded-2xl shadow-sm gap-2">
        <button
          onClick={() => setActiveTab(1)}
          className={`px-6 py-3.5 font-black text-sm flex items-center gap-2.5 border-b-2 rounded-t-xl transition-all ${
            activeTab === 1
              ? 'border-fb-blue text-fb-blue bg-fb-blue/5 shadow-xs'
              : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/40'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
          1. Cấu Hình Lịch & Đăng Bài
        </button>

        <button
          onClick={() => setActiveTab(2)}
          className={`px-6 py-3.5 font-black text-sm flex items-center gap-2.5 border-b-2 rounded-t-xl transition-all ${
            activeTab === 2
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5 shadow-xs'
              : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/40'
          }`}
        >
          <span className="material-symbols-outlined text-[20px]">queue</span>
          2. Hàng Đợi & Lịch Sử
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-fb-surface-hover text-fb-text border border-white/5">
            {imagesQueue.length + reels.length}
          </span>
        </button>
      </div>

      {/** TAB 1: CẤU HÌNH LỊCH & ĐĂNG BÀI */}
      {activeTab === 1 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/** Card 1: Kiểu bài & Tùy chọn */}
            <div className="bg-fb-surface rounded-2xl shadow-lg border border-fb-surface-hover/50 p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-fb-surface-hover/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-fb-blue text-[22px]">category</span>
                  <div>
                    <h4 className="text-base font-black text-fb-text">Định Dạng & Tùy Chọn Xuất Bản</h4>
                    <p className="text-[11px] text-fb-text-muted mt-0.5">Thiết lập cách bài viết được hiển thị và xuất bản lên Fanpage</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-fb-surface-hover/40 px-3 py-1.5 rounded-xl border border-fb-surface-hover/50 shrink-0">
                  <span className="text-xs font-bold text-fb-text">Tự động đăng:</span>
                  <button
                    onClick={() => setAutoPublishEnabled(!autoPublishEnabled)}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                      autoPublishEnabled ? 'bg-emerald-500' : 'bg-black/30 shadow-inner border border-white/5'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoPublishEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="bg-fb-surface-hover/20 p-3 rounded-xl border border-fb-surface-hover/40 text-[11px] text-fb-text-muted">
                <strong className="text-fb-text font-bold">Chế độ tự động đăng: </strong>
                {autoPublishEnabled 
                  ? 'BẬT — Các bài viết trong hàng đợi sẽ được tự động xuất bản lên Facebook đúng theo lịch trình ở cột bên phải.'
                  : 'TẮT — Bài viết hoàn thành sẽ ở trạng thái Sẵn sàng trong hàng đợi để bạn kiểm tra và duyệt đăng thủ công.'
                }
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text-muted uppercase mb-2">Kiểu bài đăng chính trên Fanpage</label>
                <CustomDropdown
                  value={postFormat}
                  onChange={setPostFormat}
                  options={[
                    { value: 'image', label: 'Đăng Ảnh 2K (Bài viết Facebook kèm ảnh AI 2K)' },
                    { value: 'reel', label: 'Đăng Video (Reels Facebook)' },
                    { value: 'mixed', label: 'Xen kẽ (Tự động luân phiên Ảnh 2K & Reel)' }
                  ]}
                />
                <p className="text-[11px] text-fb-text-muted mt-2">
                  {postFormat === 'image' && 'Chuẩn định dạng: Tiêu đề VIẾT HOA + Hook Part 1 kịch tính + Ảnh AI SangTao 2K tỉ lệ 4:5 chân thực, sắc nét.'}
                  {postFormat === 'reel' && 'Tạo video ngắn Reel 9:16 có giọng đọc AI sub voice và đăng lên Reels tab.'}
                  {postFormat === 'mixed' && 'Tự động luân phiên giữa bài viết ảnh 2K và video Reel theo lịch đăng.'}
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-fb-text-muted uppercase">Tùy chọn đính kèm link bài viết gốc</label>
                <div className="flex items-center gap-3 bg-fb-surface-hover/30 p-3.5 rounded-xl border border-fb-surface-hover/50 hover:border-fb-surface-hover transition-colors">
                  <button
                    onClick={() => setAddLinkToCaption(!addLinkToCaption)}
                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                      addLinkToCaption ? 'bg-fb-blue' : 'bg-black/30 shadow-inner border border-white/5'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${addLinkToCaption ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <div className="cursor-pointer" onClick={() => setAddLinkToCaption(!addLinkToCaption)}>
                    <p className="text-xs font-bold text-fb-text">Chèn link website vào Caption bài đăng</p>
                    <p className="text-[10px] text-fb-text-muted">Đính kèm đường dẫn website WordPress vào cuối caption để người đọc bấm vào đọc toàn bộ câu chuyện.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-fb-surface-hover/30 p-3.5 rounded-xl border border-fb-surface-hover/50 hover:border-fb-surface-hover transition-colors">
                  <button
                    onClick={() => setAddLinkToComment(!addLinkToComment)}
                    className={`relative inline-flex h-5 w-10 shrink-0 items-center rounded-full transition-colors ${
                      addLinkToComment ? 'bg-fb-blue' : 'bg-black/30 shadow-inner border border-white/5'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${addLinkToComment ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                  <div className="cursor-pointer" onClick={() => setAddLinkToComment(!addLinkToComment)}>
                    <p className="text-xs font-bold text-fb-text">Tự động bình luận Link vào bài viết (First Comment)</p>
                    <p className="text-[10px] text-fb-text-muted">Nick Fanpage sẽ tự động thả bình luận đầu tiên chứa link đọc bài viết trọn bộ ngay sau khi đăng bài.</p>
                  </div>
                </div>
              </div>
            </div>

            {/** Card 2: Nguồn Website WordPress Liên Kết */}
            <div className="bg-fb-surface rounded-2xl shadow-lg border border-fb-surface-hover/50 p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-fb-surface-hover/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[22px]">language</span>
                  <div>
                    <h4 className="text-base font-black text-fb-text">Nguồn Website WordPress & Chuyên Mục</h4>
                    <p className="text-[11px] text-fb-text-muted mt-0.5">Liên kết Fanpage với Website WP và Chuyên mục bài viết tương ứng</p>
                  </div>
                </div>
                <button
                  onClick={() => setSources([...sources, { target_site_id: '', target_category_id: '', target_tags: '', is_active: true }])}
                  className="px-3 py-1.5 bg-fb-blue/15 text-fb-blue hover:bg-fb-blue/25 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                >
                  <span className="material-symbols-outlined text-[14px]">add</span> Thêm nguồn
                </button>
              </div>

              <div className="bg-fb-surface-hover/20 p-3 rounded-xl border border-fb-surface-hover/40 text-[11px] text-fb-text-muted leading-relaxed">
                <span className="material-symbols-outlined text-[14px] text-amber-400 align-middle mr-1">info</span>
                Khi bot cào bài viết mới từ menu <strong>Website (/crawl-sources)</strong> vào Website và Chuyên mục này, bài viết kèm ảnh AI 2K sẽ tự động đưa vào hàng đợi của Fanpage này để xuất bản. Một Website có thể dùng cho nhiều Fanpage khác nhau theo từng chuyên mục riêng.
              </div>

              <div className="space-y-3">
                {sources.map((src, index) => (
                  <div key={index} className="bg-fb-surface-hover/40 p-4 rounded-xl border border-fb-surface-hover/50 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                      <div className="flex-1 w-full sm:max-w-xs">
                        <CustomDropdown
                          value={src.target_site_id}
                          onChange={v => {
                            const newSites = [...sources];
                            newSites[index].target_site_id = v;
                            newSites[index].target_category_id = '';
                            newSites[index].target_tags = '';
                            setSources(newSites);
                            if (v && !sourceCategoriesCache[v]) ztteam_loadCategories(v);
                            if (v && !sourceTagsCache[v]) ztteam_loadTags(v);
                          }}
                          options={[{ value: '', label: '-- Chọn Website WP --' }, ...sites.map(s => ({ value: s.id, label: s.wp_url }))]}
                        />
                      </div>
                      <div className="flex items-center gap-3 ml-auto shrink-0">
                        <button
                          onClick={() => {
                            const newSites = [...sources];
                            newSites[index].is_active = !newSites[index].is_active;
                            setSources(newSites);
                          }}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                            src.is_active ? 'bg-emerald-500' : 'bg-black/30 shadow-inner border border-white/5'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${src.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                        <button
                          onClick={() => setSources(sources.filter((_, i) => i !== index))}
                          className="w-8 h-8 flex items-center justify-center rounded-full text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1">Chuyên mục WordPress liên kết</label>
                        <CustomDropdown
                          value={src.target_category_id ? String(src.target_category_id) : ''}
                          onChange={v => {
                            const newSites = [...sources];
                            newSites[index].target_category_id = v ? String(v) : '';
                            setSources(newSites);
                          }}
                          options={[{ value: '', label: 'Tất cả chuyên mục (Nhận toàn bộ bài)' }, ...(sourceCategoriesCache[src.target_site_id] || []).map(c => ({ value: String(c.id), label: c.name }))]}
                          disabled={!src.target_site_id}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1">Thẻ (Tag) lọc bài viết (tùy chọn)</label>
                        <CustomDropdown
                          value={src.target_tags ? String(src.target_tags) : ''}
                          onChange={v => {
                            const newSites = [...sources];
                            newSites[index].target_tags = v ? String(v) : '';
                            setSources(newSites);
                          }}
                          options={[{ value: '', label: 'Tất cả Thẻ (Tag)' }, ...(sourceTagsCache[src.target_site_id] || []).map(t => ({ value: String(t.id), label: t.name }))]}
                          disabled={!src.target_site_id}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {sources.length === 0 && (
                  <p className="text-xs text-fb-text-muted italic text-center py-4 bg-fb-surface-hover/20 rounded-xl border border-dashed border-fb-surface-hover/50">
                    Chưa cấu hình nguồn Website WordPress. Vui lòng bấm "Thêm nguồn" ở trên để chọn Website và Chuyên mục cho Fanpage.
                  </p>
                )}
              </div>
            </div>

            {/** Card 3: Lịch Trình Xuất Bản */}
            <div className="bg-fb-surface rounded-2xl shadow-lg border border-fb-surface-hover/50 p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-fb-surface-hover/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-[22px]">schedule</span>
                  <h4 className="text-base font-black text-fb-text">Lịch Trình Xuất Bản Bài Đăng</h4>
                </div>
                <span className="text-xs text-fb-text-muted font-bold">Lên lịch tự động</span>
              </div>

              {/** Schedule Mode Tabs */}
              <div className="flex gap-2 bg-fb-surface-hover/30 rounded-xl p-1 border border-fb-surface-hover/50">
                <button
                  onClick={() => setScheduleMode('fixed')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    scheduleMode === 'fixed'
                      ? 'bg-fb-surface text-fb-text shadow-sm border border-fb-surface-hover'
                      : 'text-fb-text-muted hover:text-fb-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  Giờ cố định trong ngày
                </button>
                <button
                  onClick={() => setScheduleMode('immediate')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    scheduleMode === 'immediate'
                      ? 'bg-fb-surface text-fb-text shadow-sm border border-fb-surface-hover'
                      : 'text-fb-text-muted hover:text-fb-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                  Đăng nối tiếp (giãn cách)
                </button>
              </div>

              {scheduleMode === 'fixed' ? (
                <div className="space-y-4">
                  {/** Quick Predefined Schedules */}
                  <div>
                    <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-2">Chọn nhanh khung giờ chuẩn (3 bài / ngày):</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {predefinedSchedules.map((ps, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const hasConflict = ps.times.some(t => usedTimes.has(t));
                            if (hasConflict) {
                              ztteam_showToast('Có khung giờ trong gói này trùng với Fanpage khác!', 'error');
                            }
                            setScheduleFixedTimes(ps.times);
                          }}
                          className="px-2.5 py-2 bg-fb-surface-hover/40 hover:bg-fb-blue/15 hover:text-fb-blue text-fb-text rounded-xl border border-fb-surface-hover/60 text-[11px] font-bold transition-colors text-left"
                        >
                          <span className="block text-[10px] text-fb-text-muted">{ps.label}</span>
                          <span className="text-fb-text font-black">{ps.times.join(' - ')}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/** Custom Time Input */}
                  <div>
                    <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-1.5">Hoặc thêm giờ thủ công:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={timeInput}
                        onChange={e => setTimeInput(e.target.value)}
                        className="w-32 bg-fb-surface border border-fb-surface-hover/60 focus:ring-1 focus:ring-fb-blue rounded-xl px-3 py-2 text-xs outline-none text-fb-text font-bold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (timeInput.trim() && usedTimes.has(timeInput.trim())) {
                            ztteam_showToast(`Giờ ${timeInput} đã được dùng ở Fanpage khác!`, 'error');
                            return;
                          }
                          ztteam_addTime();
                        }}
                        className="px-4 py-2 bg-fb-blue/15 text-fb-blue font-bold rounded-xl text-xs hover:bg-fb-blue/25 transition-colors flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">add_circle</span> Thêm Giờ
                      </button>
                    </div>
                  </div>

                  {/** Active Times Badges */}
                  <div>
                    <label className="block text-[10px] font-bold text-fb-text-muted uppercase mb-2">Các khung giờ đang thiết lập ({scheduleFixedTimes.length}):</label>
                    <div className="flex flex-wrap gap-2">
                      {scheduleFixedTimes.map(t => (
                        <span
                          key={t}
                          className={`px-3 py-1.5 text-xs font-black flex items-center gap-2 rounded-xl border ${
                            usedTimes.has(t)
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-fb-blue/10 text-fb-blue border-fb-blue/25 shadow-xs'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">alarm</span>
                          {t} {usedTimes.has(t) && '(Trùng FP khác)'}
                          <span
                            onClick={() => setScheduleFixedTimes(scheduleFixedTimes.filter(x => x !== t))}
                            className="material-symbols-outlined text-[14px] cursor-pointer hover:text-rose-400"
                          >
                            close
                          </span>
                        </span>
                      ))}
                    </div>

                    {scheduleFixedTimes.length === 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl flex items-center gap-2.5 text-amber-400 text-xs mt-2">
                        <span className="material-symbols-outlined text-[20px] shrink-0">warning</span>
                        <span>Chưa thiết lập khung giờ nào! Bài viết hoàn thành sẽ ở hàng đợi và không tự xuất bản lên Facebook. Hãy chọn khung giờ nhanh ở trên.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-fb-text-muted uppercase mb-2">Khoảng cách giữa 2 bài xuất bản (Phút)</label>
                    <input
                      type="number"
                      min="10"
                      value={scheduleImmediateGap}
                      onChange={e => setScheduleImmediateGap(parseInt(e.target.value) || 60)}
                      className="w-full max-w-[240px] bg-fb-surface border border-fb-surface-hover/60 focus:ring-1 focus:ring-fb-blue rounded-xl px-4 py-2.5 text-sm outline-none text-fb-text font-bold"
                    />
                    <p className="text-[11px] text-fb-text-muted mt-2">Ví dụ đặt 60 phút: Sau khi bài trước được đăng, bài tiếp theo trong hàng đợi sẽ tự động đăng sau 60 phút.</p>
                  </div>
                </div>
              )}

              {/** Publishing Timers Status */}
              <div className="pt-4 border-t border-fb-surface-hover/50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fb-text-muted">Lần xuất bản gần nhất:</span>
                  <strong className="text-fb-text font-bold">{lastPublishTime ? ztteam_formatDate(lastPublishTime) : 'Chưa có bài đăng'}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-fb-text-muted">Dự kiến xuất bản tiếp theo:</span>
                  <strong className="text-emerald-400 font-bold">{nextPublishTime ? ztteam_formatDate(nextPublishTime) : 'Đang chờ khung giờ...'}</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/** TAB 2: HÀNG ĐỢI & LỊCH SỬ ĐĂNG BÀI */}
      {activeTab === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-fb-surface rounded-2xl shadow-lg border border-fb-surface-hover/50 overflow-hidden flex flex-col">

            {/** Queue Subheader & Switcher */}
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-fb-surface-hover/50 bg-fb-surface-hover/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQueueTab('image')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    queueTab === 'image'
                      ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                      : 'bg-fb-surface-hover text-fb-text-muted hover:text-fb-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  Hàng Đợi Ảnh 2K ({imagesQueue.length})
                </button>
                <button
                  onClick={() => setQueueTab('video')}
                  className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                    queueTab === 'video'
                      ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                      : 'bg-fb-surface-hover text-fb-text-muted hover:text-fb-text'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">movie</span>
                  Hàng Đợi Video Reel ({reels.length})
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => ztteam_loadQueue()}
                  disabled={isLoadingQueue}
                  className="px-4 py-2 bg-fb-surface-hover text-fb-text-muted hover:text-fb-text rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 border border-fb-surface-hover/50"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isLoadingQueue ? 'animate-spin' : ''}`}>refresh</span>
                  Làm mới
                </button>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Tạo thủ công
                </button>
              </div>
            </div>

            {/** Queue List Content */}
            <div className="p-6">
              {isLoadingQueue ? (
                <div className="py-20 text-center text-fb-text-muted flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-4xl text-fb-blue mb-3">refresh</span>
                  <span className="text-sm font-bold">Đang tải danh sách bài viết trong hàng đợi...</span>
                </div>
              ) : (
                (() => {
                  const displayList = queueTab === 'image' ? imagesQueue : reels;
                  if (!displayList || displayList.length === 0) {
                    return (
                      <div className="py-16 text-center text-fb-text-muted flex flex-col items-center justify-center bg-fb-surface-hover/20 rounded-2xl border border-dashed border-fb-surface-hover/50">
                        <span className="material-symbols-outlined text-5xl mb-3 text-fb-text-muted/40">
                          {queueTab === 'image' ? 'photo_library' : 'video_library'}
                        </span>
                        <p className="text-base font-bold text-fb-text">Chưa có bài viết nào trong hàng đợi {queueTab === 'image' ? 'Ảnh 2K' : 'Video Reel'}</p>
                        <p className="text-xs text-fb-text-muted mt-1 max-w-md">
                          Khi hệ thống cào bài từ Website WordPress hoặc khi bạn bấm "Tạo thủ công", các bài viết sẽ hiển thị ở đây với ảnh 2K tạo bởi AI.
                        </p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="mt-4 px-4 py-2 bg-fb-blue/15 text-fb-blue rounded-xl text-xs font-bold hover:bg-fb-blue/25 transition-colors"
                        >
                          Tạo ngay 1 bài test
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {displayList.map((item) => (
                        <ZTTeamAIPostCard
                          key={item.id}
                          item={item}
                          pageName={pageName}
                          pageAvatar={pageAvatar}
                          fbPageId={fbPageId}
                          isPosting={isPosting[item.id] || false}
                          onPostNow={(it) => ztteam_publishNow(it, queueTab)}
                          onRetry={(it) => ztteam_retryQueueItem(it, queueTab)}
                          onDelete={(it) => ztteam_deleteQueueItem(it, queueTab)}
                        />
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

          </div>
        </div>
      )}

      {/** Modal Tạo Thủ Công */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-fb-surface border border-fb-surface-hover/50 w-full max-w-lg overflow-hidden flex flex-col shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-fb-surface-hover/80 flex justify-between items-center bg-fb-surface-hover/20">
              <h3 className="text-base font-black text-fb-text tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-fb-blue">add_circle</span>
                Tạo Bài Mới Vào Hàng Đợi
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-fb-surface-hover text-fb-text-muted hover:text-rose-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/** Format Switcher */}
              <div className="flex bg-fb-surface-hover/40 p-1.5 rounded-xl border border-fb-surface-hover/50 gap-1">
                <button
                  type="button"
                  onClick={() => setManualCreateFormat('image')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    manualCreateFormat === 'image'
                      ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                      : 'text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  Ảnh 2K (Facebook Post)
                </button>
                <button
                  type="button"
                  onClick={() => setManualCreateFormat('video')}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                    manualCreateFormat === 'video'
                      ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                      : 'text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/30'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">movie</span>
                  Video Reel
                </button>
              </div>

              {/** Website Source Selection */}
              <div>
                <label className="block font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-1.5">
                  Chọn Nguồn Website <span className="text-rose-400">*</span>
                </label>
                <CustomDropdown
                  value={createSiteId}
                  onChange={v => setCreateSiteId(v)}
                  options={[
                    { value: '', label: '-- Chọn Website WP --' },
                    ...(Array.from(new Set(sources.map(s => s.target_site_id))).map(siteId => {
                      const linkedSite = sites.find(s => s.id === siteId);
                      return linkedSite ? { value: siteId, label: linkedSite.wp_url } : null;
                    }).filter(Boolean) as any[])
                  ]}
                />
              </div>

              {/** Post Selection */}
              <div>
                <label className="block font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-2">
                  Chọn Bài Viết Từ Website <span className="text-rose-400">*</span>
                  {isLoadingPosts && <span className="material-symbols-outlined text-[16px] animate-spin text-fb-blue">progress_activity</span>}
                </label>
                <CustomDropdown
                  value={createPostId}
                  onChange={v => {
                    setCreatePostId(v);
                    const post = createPosts.find(p => String(p.id) === String(v));
                    if (post) setCreatePostTitle(post.title);
                  }}
                  disabled={!createSiteId || isLoadingPosts || createPosts.length === 0}
                  options={[
                    { value: '', label: '-- Chọn Bài Viết Gần Đây --' },
                    ...createPosts.map(p => ({
                      value: p.id,
                      label: `${p.title} (${new Date(p.date).toLocaleDateString('vi-VN')})`
                    }))
                  ]}
                />
                {createPosts.length === 0 && createSiteId && !isLoadingPosts && (
                  <p className="text-xs text-rose-400 mt-1">Không tìm thấy bài viết nào trên trang web này.</p>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-fb-surface-hover/50 bg-fb-surface-hover/20 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-full font-bold text-xs bg-fb-surface-hover text-fb-text hover:bg-fb-surface-hover/80 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={ztteam_handleManualCreate}
                disabled={isCreatingQueueItem || !createPostId}
                className="px-6 py-2.5 rounded-full font-black text-xs bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {isCreatingQueueItem ? (
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">{manualCreateFormat === 'image' ? 'photo_camera' : 'movie'}</span>
                )}
                Tạo {manualCreateFormat === 'image' ? 'Ảnh 2K' : 'Reel'} Ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
