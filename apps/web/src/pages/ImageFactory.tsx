import { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import { ztteam_decodeHtmlEntity } from '../utils/stringUtils';

export default function ImageFactory() {
  const [images, setImages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPage, setFilterPage] = useState('');
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPosting, setIsPosting] = useState<Record<string, boolean>>({});
  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();

  useEffect(() => {
    ztteam_loadImages();
    ztteam_loadPages();
  }, [filterStatus, filterPage, currentPage]);

  /** SSE Live Time Update */
  useEffect(() => {
    const sse = new EventSource('/api/image/events');
    sse.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        setImages(prevImages => {
          const exists = prevImages.find(r => r.id === payload.id);
          if (exists) {
            return prevImages.map(r => r.id === payload.id ? { ...r, ...payload } : r);
          }
          return [payload, ...prevImages];
        });
      } catch (err) {}
    };
    return () => sse.close();
  }, []);

  const ztteam_loadImages = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterPage) params.append('fbPageId', filterPage);
      params.append('page', String(currentPage));
      params.append('limit', '18');

      const res = await api.get(`image/list?${params.toString()}`);
      setImages(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (error: any) {
      ztteam_showToast('Lỗi tải danh sách ảnh', 'error');
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

  const ztteam_retryImage = async (id: string) => {
    try {
      const res = await api.post(`image/retry/${id}`);
      ztteam_showToast(res.data?.message || 'Đã làm mới lại khung giờ xuất bản', 'success');
      ztteam_loadImages();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi thử lại', 'error');
    }
  };

  const ztteam_deleteImage = async (id: string) => {
    const confirmed = await ztteam_showConfirm('Xác nhận xóa', 'Xóa ảnh này khỏi hàng đợi? Hành động không thể hoàn tác.');
    if (!confirmed) return;
    try {
      await api.delete(`image/${id}`);
      ztteam_showToast('Đã xóa thành công', 'success');
      ztteam_loadImages();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi xóa', 'error');
    }
  };

  const ztteam_publishNow = async (image: any) => {
    const confirmed = await ztteam_showConfirm('Xác nhận đăng bài', `Đăng ngay ảnh "${image.wp_post_title || 'bài viết'}" lên Fanpage?`);
    if (!confirmed) return;
    try {
      setIsPosting(prev => ({ ...prev, [image.id]: true }));
      await api.post(`image/${image.id}/post-to-fb`);
      ztteam_showToast('Đã xuất bản bài viết lên Fanpage thành công', 'success');
      ztteam_loadImages();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Lỗi đăng bài lên Fanpage', 'error');
    } finally {
      setIsPosting(prev => ({ ...prev, [image.id]: false }));
    }
  };

  const ztteam_getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; border: string; label: string; pulse?: boolean }> = {
      QUEUED: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/20', label: 'Đang chờ' },
      RENDERING: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/20', label: 'Đang xử lý AI', pulse: true },
      PROCESSING: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/20', label: 'Đang tạo ảnh 2K', pulse: true },
      COMPLETED: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Sẵn sàng đăng' },
      FAILED: { bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/20', label: 'Thất bại' },
      POSTED: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/20', label: 'Đã xuất bản' },
    };
    const s = map[status] || { bg: 'bg-fb-surface-hover', text: 'text-fb-text-muted', border: 'border-white/5', label: status };
    return (
      <span className={`${s.bg} ${s.text} ${s.border} border text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs`}>
        {s.pulse && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>}
        {s.label}
      </span>
    );
  };

  const ztteam_formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full space-y-6">
      {/** Header Banner */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-fb-surface-hover/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-fb-blue/15 text-fb-blue flex items-center justify-center shadow-md shadow-blue-500/10">
            <span className="material-symbols-outlined text-2xl">photo_library</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-fb-text tracking-tight flex items-center gap-2">
              Hàng Đợi Ảnh 2K (AI Factory)
            </h3>
            <p className="text-xs text-fb-text-muted mt-0.5">
              Quản lý danh sách bài viết ảnh 2K tạo bởi AI từ website nguồn, sẵn sàng đăng lên Fanpage theo chuẩn Facebook.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="px-3.5 py-1.5 rounded-xl bg-fb-blue/10 border border-fb-blue/20 text-fb-blue text-xs font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>
            Tổng cộng: {total} bài
          </span>
        </div>
      </div>

      {/** Filter Bar */}
      <div className="bg-fb-surface rounded-2xl p-4 border border-fb-surface-hover/50 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-fb-text-muted uppercase">Trạng thái:</span>
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="bg-fb-surface-hover border border-fb-surface-hover/80 text-fb-text focus:outline-none focus:ring-1 focus:ring-fb-blue rounded-xl px-3.5 py-2 text-xs cursor-pointer font-bold"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="QUEUED">Đang chờ</option>
              <option value="RENDERING">Đang xử lý AI</option>
              <option value="COMPLETED">Sẵn sàng đăng</option>
              <option value="POSTED">Đã xuất bản</option>
              <option value="FAILED">Thất bại</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-fb-text-muted uppercase">Fanpage:</span>
            <select
              value={filterPage}
              onChange={e => { setFilterPage(e.target.value); setCurrentPage(1); }}
              className="bg-fb-surface-hover border border-fb-surface-hover/80 text-fb-text focus:outline-none focus:ring-1 focus:ring-fb-blue rounded-xl px-3.5 py-2 text-xs cursor-pointer font-bold max-w-[200px] truncate"
            >
              <option value="">Tất cả Fanpage</option>
              {pages.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={ztteam_loadImages}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-4 py-2 bg-fb-surface-hover hover:bg-fb-surface-hover/80 text-fb-text rounded-xl text-xs font-bold transition-all border border-fb-surface-hover/60"
        >
          <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>refresh</span>
          Làm mới
        </button>
      </div>

      {/** List Content */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="bg-fb-surface rounded-2xl border border-fb-surface-hover/50 p-20 text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-4xl animate-spin text-fb-blue mb-3">sync</span>
            <p className="text-sm font-bold text-fb-text-muted">Đang tải danh sách bài viết...</p>
          </div>
        ) : images.length === 0 ? (
          <div className="bg-fb-surface rounded-2xl border border-dashed border-fb-surface-hover/60 p-20 text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-6xl text-fb-text-muted/30 mb-3">photo_library</span>
            <p className="text-base font-bold text-fb-text">Chưa có bài viết nào trong hàng đợi</p>
            <p className="text-xs text-fb-text-muted mt-1">Các bài viết mới sẽ tự động xuất hiện tại đây khi tiến trình cào bài hoàn tất.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {images.map(image => {
              const isRendering = image.status === 'RENDERING' || image.status === 'PROCESSING' || image.status === 'QUEUED';
              const isCompleted = image.status === 'COMPLETED';
              const isPosted = image.status === 'POSTED';
              const isFailed = image.status === 'FAILED';
              const isPublishingNow = isPosting[image.id] || false;

              /** Build tracking link and caption preview */
              const slugify = (text: string) => {
                if (!text) return '';
                return text.toString().toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                  .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').trim();
              };
              const utmMedium = slugify(image.page?.fb_account?.name || 'account');
              const utmCampaign = slugify(image.page?.name || 'page');
              const trackingLink = image.wp_post_url ? `${image.wp_post_url}${image.wp_post_url.includes('?') ? '&' : '?'}utm_source=image&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}` : '';

              let captionText = image.ai_caption || image.wp_post_title || '';
              if (image.wp_post_url && image.page?.add_link_to_caption) {
                const prefixes = [
                  'Discover more here:',
                  'Read the full story:',
                  'Check out the details:',
                  'Full article link:',
                  'Learn more at:'
                ];
                const prefixIndex = image.id.charCodeAt(image.id.length - 1) % prefixes.length;
                captionText = `${prefixes[prefixIndex]} ${trackingLink}\n\n${captionText}`;
              }

              let commentText = image.ai_first_comment || '';
              if (image.wp_post_url && image.page?.add_link_to_comment) {
                const prefixes = [
                  'Discover more here:',
                  'Read the full story:',
                  'Check out the details:',
                  'Full article link:',
                  'Learn more at:'
                ];
                const prefixIndex = image.id.charCodeAt(image.id.length - 2) % prefixes.length;
                const ctaText = `${prefixes[prefixIndex]} ${trackingLink}`;
                commentText = commentText ? `${commentText}\n\n${ctaText}` : ctaText;
              }

              return (
                <div
                  key={image.id}
                  className="bg-fb-surface rounded-2xl border border-fb-surface-hover/60 shadow-lg hover:border-fb-blue/40 transition-all flex flex-col overflow-hidden group"
                >
                  {/** Card Header: Fanpage info & Status Badge */}
                  <div className="p-4 border-b border-fb-surface-hover/50 flex items-center justify-between gap-3 bg-fb-surface-hover/10">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {image.page?.avatar ? (
                        <img src={image.page.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0 border border-fb-blue/40" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fb-blue to-cyan-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                          {image.page?.name?.charAt(0) || 'F'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-fb-text truncate">
                          {image.page ? image.page.name : <span className="text-rose-400">[Fanpage đã gỡ]</span>}
                        </p>
                        <p className="text-[10px] text-fb-text-muted">
                          Tạo: {image.created_at ? ztteam_formatDate(image.created_at) : 'Vừa tạo'}
                        </p>
                      </div>
                    </div>
                    {ztteam_getStatusBadge(image.status)}
                  </div>

                  {/** Website Source Badge (Explicitly Requested) */}
                  <div className="px-4 py-2 bg-fb-surface-hover/20 border-b border-fb-surface-hover/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="material-symbols-outlined text-[15px] text-fb-blue shrink-0">language</span>
                      <span className="text-[10px] font-bold text-fb-text-muted uppercase shrink-0">Nguồn bài viết:</span>
                      {image.wp_post_url ? (
                        <a
                          href={image.wp_post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-fb-blue hover:underline truncate max-w-full flex items-center gap-0.5"
                          title="Bấm để mở bài viết trên Website gốc"
                        >
                          <span className="truncate">{image.wp_post_url.replace(/^https?:\/\//, '')}</span>
                          <span className="material-symbols-outlined text-[12px] shrink-0">open_in_new</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-fb-text-muted italic truncate">Chưa có link web</span>
                      )}
                    </div>
                    {image.wp_post_id && (
                      <span className="text-[10px] font-mono bg-fb-surface-hover px-1.5 py-0.5 rounded text-fb-text-muted shrink-0">
                        WP #{image.wp_post_id}
                      </span>
                    )}
                  </div>

                  {/** Card Media Preview: 4:5 Facebook Aspect Ratio */}
                  <div className="relative aspect-[4/5] bg-black/50 overflow-hidden flex items-center justify-center">
                    {isRendering ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 text-cyan-400">
                        <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                        <p className="text-xs font-bold text-white">Đang xử lý tạo ảnh SangTao.ai...</p>
                        <span className="text-[10px] text-cyan-300/80 bg-black/40 px-3 py-1 rounded-full">Chất lượng cao 2048px</span>
                      </div>
                    ) : isFailed ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center space-y-2 text-rose-400">
                        <span className="material-symbols-outlined text-4xl">error</span>
                        <p className="text-xs font-bold">Tạo ảnh thất bại</p>
                        {image.error_log && <p className="text-[10px] text-rose-300/70 max-w-xs line-clamp-2">{image.error_log}</p>}
                      </div>
                    ) : image.image_url && image.image_url !== 'DELETED' ? (
                      <div
                        className="w-full h-full relative cursor-pointer group/media overflow-hidden"
                        onClick={() => window.open(image.image_url, '_blank')}
                      >
                        <img
                          src={image.image_url}
                          alt={image.wp_post_title || 'Media'}
                          className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-500"
                          onError={(e: any) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-black text-cyan-400 border border-white/10 tracking-wider">
                          ẢNH 2K SANGTAO.AI
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity bg-black/30">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-fb-blue to-cyan-500 text-white flex items-center justify-center shadow-xl shadow-cyan-500/30 scale-95 group-hover/media:scale-105 transition-transform">
                            <span className="material-symbols-outlined text-2xl">zoom_in</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-4 text-fb-text-muted">
                        <span className="material-symbols-outlined text-3xl mb-1">broken_image</span>
                        <p className="text-xs">Ảnh không khả dụng</p>
                      </div>
                    )}
                  </div>

                  {/** Content Body: Title HOA, Caption Part 1, First Comment */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col">
                    {/** Title in UPPERCASE */}
                    <h5 className="font-black text-sm text-fb-text uppercase line-clamp-2 leading-snug">
                      {ztteam_decodeHtmlEntity(image.wp_post_title)?.toUpperCase() || 'NỘI DUNG BÀI VIẾT'}
                    </h5>

                    {/** Caption Part 1 / Hook */}
                    <p className="text-xs text-fb-text-muted line-clamp-3 leading-relaxed flex-1">
                      {captionText}
                    </p>

                    {/** First Comment Preview */}
                    {commentText && (
                      <div className="bg-fb-surface-hover/40 p-2.5 rounded-xl border border-fb-surface-hover/50 text-[11px] text-fb-text-muted">
                        <span className="font-black text-fb-text mb-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-fb-blue">chat</span>
                          Bình luận đính kèm (First Comment):
                        </span>
                        <p className="line-clamp-2 italic">{commentText}</p>
                      </div>
                    )}

                    {/** Facebook Link if already posted */}
                    {isPosted && image.fb_post_id && (
                      <div className="pt-2 border-t border-fb-surface-hover/50 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span> Đã xuất bản lên Facebook
                        </span>
                        <a
                          href={`https://www.facebook.com/${image.page?.fb_page_id}/posts/${image.fb_post_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-fb-blue/15 hover:bg-fb-blue/25 text-fb-blue rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          Xem trên FB <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                        </a>
                      </div>
                    )}
                  </div>

                  {/** Card Actions Footer */}
                  <div className="p-4 border-t border-fb-surface-hover/50 bg-fb-surface-hover/20 flex items-center justify-between gap-2">
                    <button
                      onClick={() => ztteam_deleteImage(image.id)}
                      className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                      title="Xóa bài viết này"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                      Xóa
                    </button>

                    <div className="flex items-center gap-2">
                      {/** Download Image */}
                      {image.image_url && image.image_url !== 'DELETED' && (
                        <a
                          href={image.image_url}
                          download={`story_${image.id}.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-xl bg-fb-surface-hover hover:bg-fb-surface-hover/80 text-fb-text-muted hover:text-fb-text flex items-center justify-center transition-colors"
                          title="Tải ảnh gốc 2K"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                        </a>
                      )}

                      {/** Retry if failed */}
                      {isFailed && (
                        <button
                          onClick={() => ztteam_retryImage(image.id)}
                          className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">refresh</span>
                          Thử lại
                        </button>
                      )}

                      {/** Publish Now */}
                      {isCompleted && !isPosted && image.page && (
                        <button
                          onClick={() => ztteam_publishNow(image)}
                          disabled={isPublishingNow}
                          className="px-4 py-2 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white rounded-xl text-xs font-black shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isPublishingNow ? (
                            <>
                              <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                              Đang đăng...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-[16px]">send</span>
                              Đăng Ngay
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/** Pagination */}
        {total > 0 && Math.ceil(total / 18) > 1 && (
          <div className="flex justify-center items-center gap-4 mt-8 bg-fb-surface py-3 px-5 mx-auto w-fit rounded-2xl border border-fb-surface-hover/50 shadow-sm">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-fb-surface-hover text-fb-text hover:bg-fb-blue hover:text-white disabled:opacity-30 disabled:hover:bg-fb-surface-hover disabled:hover:text-fb-text transition-colors font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-xs font-bold text-fb-text">Trang {currentPage} / {Math.ceil(total / 18)}</span>
            <button
              disabled={currentPage >= Math.ceil(total / 18)}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-fb-surface-hover text-fb-text hover:bg-fb-blue hover:text-white disabled:opacity-30 disabled:hover:bg-fb-surface-hover disabled:hover:text-fb-text transition-colors font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
