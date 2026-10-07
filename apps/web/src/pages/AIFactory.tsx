import { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { ztteam_decodeHtmlEntity } from '../utils/stringUtils';
import CustomDropdown from '../components/CustomDropdown';
import ZTTeamAIPostCard from '../components/AIPostCard';

/**
 * ZTTeam AIFactory Component
 * Quản lý hàng đợi bài viết & ảnh 2K SangTao.ai chuẩn Facebook Feed
 */
export default function AIFactory() {
  /** Data List States */
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  /** Filter States */
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPosting, setIsPosting] = useState<Record<string, boolean>>({});

  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();

  /** Load pages list on mount */
  useEffect(() => {
    ztteam_loadPages();
  }, []);

  /** Fetch item list whenever filterStatus, filterPage or currentPage changes */
  useEffect(() => {
    ztteam_loadItems();
  }, [filterStatus, filterPage, currentPage]);

  /** SSE Live Time Update & Background Polling for image queue */
  useEffect(() => {
    const sse = new EventSource('/api/image/events');

    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setItems(prevItems => {
          const exists = prevItems.find(r => r.id === payload.id);
          if (exists) return prevItems.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          return [payload, ...prevItems];
        });
      } catch (err) { /** ignore parse error */ }
    };

    /** Background silent polling every 3 seconds */
    const interval = setInterval(() => {
      ztteam_loadItems(true);
    }, 3000);

    return () => {
      sse.close();
      clearInterval(interval);
    };
  }, [filterStatus, filterPage, currentPage]);

  /** Fetch items from API */
  const ztteam_loadItems = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPage) params.append('fbPageId', filterPage);
      params.append('page', String(currentPage));
      params.append('limit', '20');

      const res = await api.get(`image/list?${params.toString()}`);
      setItems(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      if (!isSilent) ztteam_showToast('Lỗi tải danh sách bài viết AI', 'error');
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  /** Fetch active Facebook pages for filter */
  const ztteam_loadPages = async () => {
    try {
      const res = await api.get('facebook/pages');
      setPages(res.data || []);
    } catch { /** ignore */ }
  };

  /** Retry Item */
  const ztteam_retryItem = async (itemOrId: any) => {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (!id) return;
    try {
      const res = await api.post(`image/retry/${id}`);
      ztteam_showToast(res.data?.message || 'Đã làm mới lại khung giờ xuất bản', 'success');
      ztteam_loadItems();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi làm mới', 'error');
    }
  };

  /** Delete Item */
  const ztteam_deleteItem = async (itemOrId: any) => {
    const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
    if (!id) return;
    const confirmed = await ztteam_showConfirm('Xác nhận xóa', 'Xóa bài viết này khỏi hàng đợi? Hành động không thể hoàn tác.');
    if (!confirmed) return;
    try {
      await api.delete(`image/${id}`);
      ztteam_showToast('Đã xóa thành công', 'success');
      ztteam_loadItems();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi xóa', 'error');
    }
  };

  /** Direct Post to FB Page */
  const ztteam_postToFB = async (item: any) => {
    const confirmed = await ztteam_showConfirm('Đăng ngay lên Fanpage', 'Bạn muốn đăng bài viết này lên Fanpage ngay bây giờ?');
    if (!confirmed) return;

    try {
      setIsPosting(prev => ({ ...prev, [item.id]: true }));
      await api.post(`image/${item.id}/post-to-fb`);
      ztteam_showToast('Đã đăng bài lên Fanpage thành công', 'success');
      ztteam_loadItems();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi đăng bài', 'error');
    } finally {
      setIsPosting(prev => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">

      {/* Header Banner */}
      <div className="bg-fb-surface rounded-2xl shadow-lg border border-fb-surface-hover/50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-3xl">auto_awesome</span>
            AI Factory
          </h2>
          <p className="text-sm font-medium text-fb-text-muted mt-1">
            Quản lý và giám sát hàng đợi bài viết & ảnh 2K SangTao.ai tự động xuất bản lên Fanpage Facebook.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400 text-xs font-bold shrink-0">
          <span className="material-symbols-outlined text-base">photo_library</span>
          <span>Hàng đợi: {total} bài viết</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-fb-surface rounded-2xl p-4 shadow-lg border border-fb-surface-hover/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-fb-text-muted uppercase shrink-0">Trạng thái:</span>
            <CustomDropdown
              value={filterStatus}
              onChange={(val) => { setFilterStatus(val); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'QUEUED', label: 'Đang chờ (Queued)' },
                { value: 'RENDERING', label: 'Đang render (Rendering)' },
                { value: 'COMPLETED', label: 'Sẵn sàng (Completed)' },
                { value: 'POSTED', label: 'Đã đăng (Posted)' },
                { value: 'FAILED', label: 'Lỗi (Failed)' },
              ]}
              className="w-44"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-fb-text-muted uppercase shrink-0">Fanpage:</span>
            <CustomDropdown
              value={filterPage}
              onChange={(val) => { setFilterPage(val); setCurrentPage(1); }}
              options={[
                { value: '', label: 'Tất cả Fanpage' },
                ...pages.map((p: any) => ({
                  value: p.id,
                  label: ztteam_decodeHtmlEntity(p.name)
                }))
              ]}
              className="w-52"
            />
          </div>
        </div>

        <button
          onClick={() => ztteam_loadItems()}
          className="flex items-center gap-1.5 px-4 py-2 bg-fb-surface-hover hover:bg-fb-surface-hover/80 text-fb-text rounded-full text-xs font-bold transition-all border border-fb-surface-hover/50"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Làm Mới
        </button>
      </div>

      {/* Main Grid Content */}
      <div className="bg-fb-surface rounded-2xl p-6 shadow-lg border border-fb-surface-hover/50 min-h-[400px]">
        {isLoading ? (
          <div className="py-24 text-center text-fb-text-muted flex flex-col items-center justify-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-fb-blue mb-3">refresh</span>
            <span className="text-sm font-bold text-fb-text">Đang tải danh sách bài viết...</span>
          </div>
        ) : !items || items.length === 0 ? (
          <div className="py-24 text-center text-fb-text-muted flex flex-col items-center justify-center bg-fb-surface-hover/20 rounded-2xl border border-white/5">
            <span className="material-symbols-outlined text-5xl mb-3 text-fb-text-muted/40">
              photo_library
            </span>
            <p className="text-base font-bold text-fb-text">
              Chưa có bài viết nào trong hàng đợi AI Factory
            </p>
            <p className="text-xs text-fb-text-muted mt-1">
              Các bài viết mới sau khi cào và tạo ảnh 2K sẽ tự động xuất hiện tại đây.
            </p>
          </div>
        ) : (
          /* Facebook Feed Post Card Grid 4:5 - Dong bo ZTTeamAIPostCard */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <ZTTeamAIPostCard
                key={item.id}
                item={item}
                isPosting={isPosting[item.id] || false}
                onPostNow={ztteam_postToFB}
                onRetry={ztteam_retryItem}
                onDelete={ztteam_deleteItem}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
