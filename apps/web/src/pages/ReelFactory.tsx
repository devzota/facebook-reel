import { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { ztteam_decodeHtmlEntity } from '../utils/stringUtils';

export default function ReelFactory() {
  const [reels, setReels] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPosting, setIsPosting] = useState<Record<string, boolean>>({});
  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();

  useEffect(() => {
    ztteam_loadReels();
    ztteam_loadPages();
  }, [filterStatus, filterPage, currentPage]);

  /** SSE Live Time Update */
  useEffect(() => {
    const sse = new EventSource(`/api/render/events`);
    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setReels(prevReels => {
          const exists = prevReels.find(r => r.id === payload.id);
          if (exists) return prevReels.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          return [payload, ...prevReels];
        });
      } catch (err) { }
    };
    return () => sse.close();
  }, []);

  const ztteam_loadReels = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPage) params.append('fbPageId', filterPage);
      params.append('page', String(currentPage));
      params.append('limit', '20');

      const res = await api.get(`render/list?${params.toString()}`);
      setReels(res.data.reels || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      ztteam_showToast('Lỗi tải danh sách reel', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const ztteam_loadPages = async () => {
    try {
      const res = await api.get('facebook/pages');
      setPages(res.data || []);
    } catch { /** ignore */ }
  };

  const ztteam_retryReel = async (id: string) => {
    try {
      await api.post(`render/retry/${id}`);
      ztteam_showToast('Đã thêm lại vào hàng đợi render', 'success');
      ztteam_loadReels();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi retry', 'error');
    }
  };

  const ztteam_deleteReel = async (id: string) => {
    const confirmed = await ztteam_showConfirm('Xác nhận xóa', 'Xóa reel này?');
    if (!confirmed) return;
    try {
      await api.post(`render/delete/${id}`);
      ztteam_showToast('Đã xóa reel', 'success');
      ztteam_loadReels();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi xóa', 'error');
    }
  };

  const ztteam_getStatusIcon = (status: string) => {
    const map: Record<string, { icon: string; color: string; title: string }> = {
      QUEUED: { icon: 'hourglass_empty', color: 'text-amber-500 bg-amber-50', title: 'Đang chờ' },
      RENDERING: { icon: 'settings', color: 'text-blue-500 bg-blue-50 animate-spin', title: 'Đang render' },
      COMPLETED: { icon: 'check_circle', color: 'text-emerald-500 bg-emerald-50', title: 'Hoàn thành' },
      FAILED: { icon: 'error', color: 'text-red-500 bg-red-50', title: 'Lỗi' },
      POSTED: { icon: 'publish', color: 'text-blue-500 bg-blue-50', title: 'Đã đăng' },
    };
    const s = map[status] || { icon: 'help', color: 'text-gray-500 bg-gray-50', title: status };
    return (
      <div title={s.title} className={`w-8 h-8 rounded-full flex items-center justify-center ${s.color}`}>
        <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
      </div>
    );
  };

  const ztteam_formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full space-y-6">
      
      {/* Header Banner */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400">movie_creation</span>
            AI Reel Factory
          </h2>
          <p className="text-sm font-medium text-fb-text-muted mt-1">Quản lý và theo dõi tiến trình Render Video Reels tự động.</p>
        </div>
        
        <div className="flex items-center gap-3">
           <button
             onClick={ztteam_loadReels}
             className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white rounded-full text-sm font-bold transition-all shadow-lg shadow-cyan-500/20 active:scale-95"
           >
             <span className="material-symbols-outlined text-[18px]">refresh</span>
             Làm Mới
           </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-fb-surface rounded-2xl p-4 shadow-lg flex flex-wrap gap-4 items-center border border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-fb-text-muted">Trạng thái:</span>
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="bg-fb-surface-hover text-fb-text border-none focus:ring-2 focus:ring-cyan-500 rounded-full px-4 py-2 text-sm appearance-none cursor-pointer font-semibold outline-none transition-all"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="QUEUED">Đang chờ (Queued)</option>
            <option value="RENDERING">Đang render (Rendering)</option>
            <option value="COMPLETED">Hoàn thành (Completed)</option>
            <option value="POSTED">Đã đăng (Posted)</option>
            <option value="FAILED">Lỗi (Failed)</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-fb-text-muted">Fanpage:</span>
          <select
            value={filterPage}
            onChange={e => { setFilterPage(e.target.value); setCurrentPage(1); }}
            className="bg-fb-surface-hover text-fb-text border-none focus:ring-2 focus:ring-cyan-500 rounded-full px-4 py-2 text-sm appearance-none cursor-pointer font-semibold outline-none transition-all"
          >
            <option value="">Tất cả Fanpage</option>
            {pages.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-fb-surface rounded-2xl p-16 text-center shadow-lg border border-white/5">
            <span className="material-symbols-outlined text-5xl animate-spin text-cyan-400">progress_activity</span>
            <p className="text-cyan-400 font-bold mt-4 animate-pulse">Đang tải dữ liệu...</p>
          </div>
        ) : reels.length === 0 ? (
          <div className="bg-fb-surface rounded-2xl p-16 text-center shadow-lg border border-white/5">
            <span className="material-symbols-outlined text-6xl text-fb-text-muted/50 mb-3 block">movie_filter</span>
            <p className="text-fb-text mt-4 text-xl font-bold">Chưa có Video nào</p>
            <p className="text-fb-text-muted text-sm mt-1">Các video Reel đã tạo sẽ hiển thị tại đây.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {reels.map(reel => (
              <div key={reel.id} className="bg-fb-surface rounded-2xl border border-white/5 overflow-hidden shadow-lg flex flex-col h-full hover:ring-2 hover:ring-cyan-500/30 transition-all group">
                
                {/* Header Card (Action Bar) */}
                <div className="px-4 py-3 border-b border-white/5 bg-fb-surface-hover/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ztteam_getStatusIcon(reel.status)}
                    {reel.wp_post_url && (
                      <a href={reel.wp_post_url} target="_blank" rel="noreferrer" title="Xem bài viết gốc" className="w-8 h-8 rounded-full bg-fb-surface-hover hover:bg-fb-surface flex items-center justify-center text-fb-text-muted hover:text-cyan-400 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">link</span>
                      </a>
                    )}
                    {reel.status === 'POSTED' && reel.fb_post_id && reel.page?.fb_page_id && (
                      <a href={`https://www.facebook.com/${reel.page.fb_page_id}/videos/${reel.fb_post_id}`} target="_blank" rel="noreferrer" title="Xem bài đã đăng trên Fanpage" className="w-8 h-8 rounded-full bg-blue-500/15 hover:bg-blue-500/30 flex items-center justify-center text-blue-400 transition-colors">
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {reel.video_url === 'DELETED' && (
                      <span className="text-[11px] bg-red-500/10 text-red-400 px-2.5 py-1 rounded-full font-bold border border-red-500/20 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                        Đã xóa
                      </span>
                    )}
                    {reel.status === 'COMPLETED' && reel.video_url && reel.video_url !== 'DELETED' && (
                      <a href={reel.video_url} target="_blank" rel="noreferrer" title="Tải Video" className="w-8 h-8 rounded-full bg-emerald-500/15 hover:bg-emerald-500/30 flex items-center justify-center text-emerald-400 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[18px]">download</span>
                      </a>
                    )}
                    {reel.status === 'COMPLETED' && reel.page && (
                      <button
                        title="Đăng ngay lên Fanpage"
                        disabled={isPosting[reel.id]}
                        onClick={async () => {
                          const confirmed = await ztteam_showConfirm('Đăng ngay', 'Bạn muốn đăng video này lên Fanpage ngay bây giờ?');
                          if (!confirmed) return;
                          try {
                            setIsPosting(prev => ({ ...prev, [reel.id]: true }));
                            await api.post(`render/post/${reel.id}`);
                            ztteam_showToast('Đã đăng thành công', 'success');
                            ztteam_loadReels();
                          } catch (error: any) {
                            ztteam_showToast(error.response?.data?.message || 'Lỗi đăng bài', 'error');
                          } finally {
                            setIsPosting(prev => ({ ...prev, [reel.id]: false }));
                          }
                        }}
                        className="w-8 h-8 rounded-full bg-cyan-500/15 hover:bg-cyan-500/30 flex items-center justify-center text-cyan-400 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isPosting[reel.id] ? <span className="material-symbols-outlined text-[18px] animate-spin">sync</span> : <span className="material-symbols-outlined text-[18px]">publish</span>}
                      </button>
                    )}
                    {(reel.status === 'FAILED' || reel.status === 'COMPLETED') && (
                      <button title="Render lại Video" onClick={() => ztteam_retryReel(reel.id)} className="w-8 h-8 rounded-full bg-fb-surface-hover hover:bg-white/10 flex items-center justify-center text-fb-text-muted hover:text-fb-text transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                      </button>
                    )}
                    <button title="Xóa" onClick={() => ztteam_deleteReel(reel.id)} className="w-8 h-8 rounded-full bg-red-500/15 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition-colors cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>

                {/* Profile & Info */}
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 flex-shrink-0 bg-fb-surface-hover rounded-full flex items-center justify-center text-cyan-400 font-black text-sm overflow-hidden shadow-sm border border-white/5">
                    {reel.page?.avatar ? (
                      <img src={reel.page.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      reel.page?.name?.charAt(0) || 'P'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[13px] text-fb-text leading-tight truncate" title={ztteam_decodeHtmlEntity(reel.wp_post_title) || 'Reel'}>
                      {ztteam_decodeHtmlEntity(reel.wp_post_title) || 'Reel AI'}
                    </p>
                    <p className="font-semibold text-[11px] text-fb-text-muted leading-tight truncate mt-0.5">
                      {reel.page ? reel.page.name : <span className="text-red-400">[Fanpage đã gỡ]</span>}
                    </p>
                    <div className="text-[10px] text-fb-text-muted flex flex-col mt-1 leading-tight">
                      <span className="truncate">Tạo: {ztteam_formatDate(reel.created_at)}</span>
                      <span className={`font-bold truncate mt-0.5 ${reel.status === 'POSTED' ? 'text-emerald-400' : (reel.scheduled_at ? 'text-cyan-400' : 'text-amber-400')}`}>
                        {reel.status === 'POSTED' ? 'Đã đăng: ' : (reel.scheduled_at ? 'Tiếp theo: ' : '')}
                        {reel.status === 'POSTED' && reel.posted_at ? ztteam_formatDate(reel.posted_at) : (reel.scheduled_at ? ztteam_formatDate(reel.scheduled_at) : 'Chưa cấu hình')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* FB Caption */}
                {reel.final_caption ? (
                  <div className="px-4 pb-3 text-[12px] text-fb-text/90 whitespace-pre-wrap break-words leading-relaxed overflow-y-auto max-h-32 custom-scrollbar">
                    {reel.final_caption}
                  </div>
                ) : reel.ai_script ? (
                  <div className="px-4 pb-3 text-[12px] text-fb-text-muted italic whitespace-pre-wrap break-words">
                    Script: {reel.ai_script}
                  </div>
                ) : null}

                {/* FB Video Preview (Thumb) */}
                <div className="mt-auto relative aspect-[4/5] bg-fb-bg flex items-center justify-center border-y border-white/5 overflow-hidden group/thumb">
                  {reel.status === 'RENDERING' ? (
                    <div className="flex flex-col items-center justify-center p-4">
                      <div className="relative mb-3">
                         <span className="material-symbols-outlined text-4xl text-cyan-400 animate-spin">settings</span>
                         <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-cyan-400/30 animate-ping"></span>
                      </div>
                      <div className="w-32 bg-fb-surface rounded-full h-1.5 mt-2 overflow-hidden ring-1 ring-cyan-500/20">
                        <div className="bg-gradient-to-r from-fb-blue to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${reel.progress}%` }}></div>
                      </div>
                      <p className="text-[11px] text-cyan-400 font-bold mt-2">{reel.progress}%</p>
                    </div>
                  ) : reel.status === 'FAILED' ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <span className="material-symbols-outlined text-4xl text-red-500 mb-2">error</span>
                      <p className="text-[11px] text-red-400 line-clamp-3 px-2 font-medium">{reel.error_log}</p>
                    </div>
                  ) : (
                    <>
                      {reel.thumbnail_url ? (
                        <img
                          src={reel.thumbnail_url}
                          alt="Reel thumb"
                          className="w-full h-full object-contain opacity-80 group-hover/thumb:opacity-100 group-hover/thumb:scale-105 transition-all duration-500"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('.broken-icon')) {
                              parent.insertAdjacentHTML('afterbegin', '<span class="material-symbols-outlined text-4xl text-fb-text-muted/50 broken-icon">broken_image</span>');
                            }
                          }}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-fb-surface-hover">movie</span>
                      )}
                      {(reel.status === 'COMPLETED' || reel.status === 'POSTED') && (
                        reel.video_url !== 'DELETED' ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover/thumb:bg-black/60 transition-colors cursor-pointer">
                            <a href={reel.video_url} target="_blank" rel="noreferrer" className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl transform group-hover/thumb:scale-110 transition-transform ring-1 ring-white/30">
                              <span className="material-symbols-outlined text-white text-3xl ml-1">play_arrow</span>
                            </a>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-2 text-center pointer-events-none backdrop-blur-sm">
                            <span className="material-symbols-outlined text-3xl mb-2 text-red-500">broken_image</span>
                            <span className="text-xs font-bold text-red-100">Video đã bị xóa</span>
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>

                {/* FB Comment Preview */}
                {reel.final_comment && (
                  <div className="px-4 py-3 bg-fb-surface-hover/30 flex gap-2 border-t border-white/5">
                    <div className="w-7 h-7 flex-shrink-0 bg-fb-surface rounded-full flex items-center justify-center text-cyan-400 font-bold text-[10px] uppercase overflow-hidden border border-white/10 ring-1 ring-cyan-500/20">
                      {reel.page?.avatar ? (
                        <img src={reel.page.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        reel.page?.name?.charAt(0) || 'P'
                      )}
                    </div>
                    <div className="bg-fb-surface rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-fb-text flex-1 shadow-sm border border-white/5">
                      <span className="font-bold text-cyan-400 block mb-0.5 truncate max-w-[150px]">{reel.page?.name || 'Fanpage'}</span>
                      <span className="whitespace-pre-wrap break-words leading-relaxed">{reel.final_comment}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="flex justify-center items-center gap-4 mt-8 bg-fb-surface rounded-full py-2 px-4 shadow-lg mx-auto w-fit border border-white/5">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-fb-surface-hover text-fb-text hover:bg-cyan-500 hover:text-white disabled:opacity-30 disabled:hover:bg-fb-surface-hover transition-colors font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-bold text-fb-text">Trang {currentPage} / {Math.ceil(total / 20)}</span>
            <button
              disabled={currentPage >= Math.ceil(total / 20)}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-fb-surface-hover text-fb-text hover:bg-cyan-500 hover:text-white disabled:opacity-30 disabled:hover:bg-fb-surface-hover transition-colors font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
