import React, { useState } from 'react';

export interface ZTTeamAIPostCardProps {
  item: any;
  pageName?: string;
  pageAvatar?: string;
  fbPageId?: string;
  isPosting?: boolean;
  onPostNow?: (item: any) => void;
  onRetry?: (item: any) => void;
  onDelete?: (item: any) => void;
  onZoom?: (imageUrl: string) => void;
  onQueueVideo?: (item: any) => void;
  onUseOriginalImage?: (item: any) => void;
}

/**
 * Reusable Unified AI Post Card Component
 * Shared between AI Factory and Facebook Page Settings Queue
 */
export default function ZTTeamAIPostCard({
  item,
  pageName,
  pageAvatar,
  fbPageId,
  isPosting = false,
  onPostNow,
  onRetry,
  onDelete,
  onZoom,
  onQueueVideo,
  onUseOriginalImage,
}: ZTTeamAIPostCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const isRendering = item.status === 'RENDERING' || item.status === 'PROCESSING' || item.status === 'QUEUED';
  const isCompleted = item.status === 'COMPLETED';
  const isPosted = item.is_posted || item.status === 'POSTED';
  const isFailed = item.status === 'FAILED';
  const hasImage = Boolean(item.image_url);
  /** ZTTeam: Cho phép Đăng Ngay thủ công bất cứ lúc nào đã có ảnh và chưa đăng Facebook thành công (kể cả khi vừa bị lỗi đăng) */
  const canPostNow = hasImage && !isPosted && !isRendering;
  const isAlreadyPosted = isPosted;

  const resolvedPageName = pageName || item.page?.name || 'Fanpage Facebook';
  const resolvedAvatar = pageAvatar || item.page?.avatar;
  const resolvedFbPageId = fbPageId || item.page?.fb_page_id;

  /** Format Date: Định dạng ngắn gọn HH:mm dd/MM (ví dụ: 16:30 07/10) */
  const ztteam_formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--';
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    return `${h}:${m} ${day}/${mon}`;
  };

  /** Status Badge */
  const ztteam_renderStatusBadge = () => {
    if (isAlreadyPosted) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]">check_circle</span>
          Đã đăng
        </span>
      );
    }
    switch (item.status) {
      case 'QUEUED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">hourglass_empty</span>
            Chờ xử lý
          </span>
        );
      case 'RENDERING':
      case 'PROCESSING':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
            Đang tạo ảnh 2K
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">check</span>
            Sẵn sàng đăng
          </span>
        );
      case 'FAILED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">error</span>
            {hasImage ? 'Lỗi đăng FB' : 'Lỗi tạo ảnh'}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/20 text-gray-300 border border-gray-500/30">
            {item.status}
          </span>
        );
    }
  };

  const storyContent = item.ai_caption || item.final_caption || item.wp_post_title || 'Nội dung trích đoạn bài viết...';
  const displayTime = item.updated_at || item.created_at;

  return (
    <div className="bg-fb-surface rounded-2xl border border-fb-surface-hover/60 shadow-lg hover:border-fb-blue/40 transition-all flex flex-col overflow-hidden group">
      {/** 1. Top Source Badge Bar */}
      <div className="px-4 py-2 bg-fb-surface-hover/30 border-b border-fb-surface-hover/50 flex items-center justify-between text-[11px] text-fb-text-muted">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="material-symbols-outlined text-[15px] text-fb-blue shrink-0">language</span>
          <span className="font-semibold truncate">
            {item.wp_post_url ? (
              <a
                href={item.wp_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-400 hover:underline transition-colors"
              >
                {item.wp_post_url.replace(/^https?:\/\//, '')}
              </a>
            ) : (
              <span>Nguồn: WordPress Post #{item.wp_post_id}</span>
            )}
          </span>
        </div>
        {item.wp_post_url && (
          <a
            href={item.wp_post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1 hover:bg-fb-surface-hover rounded text-fb-text-muted hover:text-white transition-colors"
            title="Mở bài viết gốc trên website"
          >
            <span className="material-symbols-outlined text-[15px]">open_in_new</span>
          </a>
        )}
      </div>

      {/** 2. Facebook Post Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {resolvedAvatar ? (
            <img
              src={resolvedAvatar}
              alt={resolvedPageName}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover shrink-0 border border-white/10 shadow-xs"
              onError={(e: any) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 shrink-0 flex items-center justify-center text-white font-black text-sm">
              {resolvedPageName ? resolvedPageName.charAt(0) : 'F'}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-fb-text truncate leading-tight">
              {resolvedPageName}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-fb-text-muted mt-0.5">
              <span>{isAlreadyPosted ? `Đã đăng: ${ztteam_formatDate(item.posted_at || item.updated_at)}` : item.scheduled_at ? `Dự kiến: ${ztteam_formatDate(item.scheduled_at)}` : `Tạo lúc: ${ztteam_formatDate(item.created_at)}`}</span>
              <span>•</span>
              <span className="material-symbols-outlined text-[13px]">public</span>
            </div>
          </div>
        </div>
        <div>{ztteam_renderStatusBadge()}</div>
      </div>

      {/** 2.1. Timeline Info Bar (Thời gian POST, IMG, Video) */}
      <div className="px-3 py-1.5 bg-fb-surface-hover/20 border-y border-fb-surface-hover/40 grid grid-cols-3 gap-1 text-[10px]">
        <div className="text-fb-text-muted truncate min-w-0" title={`Tạo bài viết: ${ztteam_formatDate(item.created_at)}`}>
          <span className="font-extrabold text-cyan-400">POST:</span>{' '}
          <strong className="text-white/90 font-medium">{ztteam_formatDate(item.created_at)}</strong>
        </div>

        <div className="text-fb-text-muted truncate min-w-0" title={`Tạo ảnh: ${item.image_url ? ztteam_formatDate(item.updated_at) : '--'}`}>
          <span className="font-extrabold text-blue-400">IMG:</span>{' '}
          <strong className="text-white/90 font-medium">{item.image_url ? ztteam_formatDate(item.updated_at) : '--'}</strong>
        </div>

        <div className="text-fb-text-muted truncate min-w-0" title={item.video_status === 'FAILED' ? `Lỗi tạo video: ${item.error_log || 'Thất bại'}` : (item.video_created_at ? `Tạo video: ${ztteam_formatDate(item.video_created_at)}` : (item.video_url ? `Tạo video: ${ztteam_formatDate(item.updated_at)}` : (item.video_status === 'PENDING' ? 'Đang tạo video...' : '--')))}>
          <span className="font-extrabold text-amber-400">Video:</span>{' '}
          <strong className={`font-medium ${item.video_status === 'FAILED' ? 'text-red-400 font-bold' : 'text-white/90'}`}>
            {item.video_status === 'FAILED' ? 'Lỗi' : (item.video_created_at ? ztteam_formatDate(item.video_created_at) : (item.video_url ? ztteam_formatDate(item.updated_at) : (item.video_status === 'PENDING' ? 'Đang tạo' : '--')))}
          </strong>
        </div>

        {isAlreadyPosted ? (
          <div className="col-span-3 flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
            <span className="material-symbols-outlined text-[14px] shrink-0">check_circle</span>
            <span className="font-semibold">Đã đăng FB: {ztteam_formatDate(item.posted_at || item.updated_at)}</span>
          </div>
        ) : item.scheduled_at ? (
          <div className="col-span-3 flex items-center gap-1.5 text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20">
            <span className="material-symbols-outlined text-[14px] shrink-0">schedule</span>
            <span className="font-semibold">Lịch đăng dự kiến: {ztteam_formatDate(item.scheduled_at)}</span>
          </div>
        ) : (
          <div className="col-span-3 flex items-center gap-1.5 text-fb-text-muted bg-fb-surface-hover/40 px-2 py-1 rounded-lg border border-white/5">
            <span className="material-symbols-outlined text-[14px] shrink-0">pause_circle</span>
            <span>Chờ xếp lịch hoặc đăng thủ công</span>
          </div>
        )}
      </div>

      {/** 3. Post Title - UPPERCASE Hook */}
      <div className="px-4 py-2">
        <h3 className="text-sm font-black text-fb-text leading-snug line-clamp-2 uppercase tracking-wide">
          {item.wp_post_title || 'TIÊU ĐỀ BÀI VIẾT'}
        </h3>
      </div>

      {/** 4. Media Container 4:5 */}
      <div className="px-4 py-1">
        <div className="w-full aspect-[4/5] bg-black/60 rounded-xl relative overflow-hidden group/media border border-white/5">
          {/** Badges Top Bar */}
          <div className="absolute top-2.5 left-2.5 right-2.5 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-[10px] font-bold text-cyan-300 shadow-md">
              <span className="material-symbols-outlined text-xs">auto_awesome</span>
              ẢNH 2K AI
            </div>

            {item.video_url ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowVideo(!showVideo);
                }}
                className={`pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shadow-md cursor-pointer ${
                  showVideo
                    ? 'bg-amber-400 text-black shadow-amber-400/20'
                    : 'bg-black/70 backdrop-blur-md border border-amber-400/40 text-amber-300 hover:bg-black/90'
                }`}
                title="Bấm để chuyển đổi giữa Ảnh và Video Reel"
              >
                <span className="material-symbols-outlined text-xs">
                  {showVideo ? 'photo' : 'movie'}
                </span>
                <span>{showVideo ? 'XEM ẢNH' : 'REEL 15S'}</span>
              </button>
            ) : item.video_status === 'PENDING' ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 backdrop-blur-md animate-pulse shadow-md">
                <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                ĐANG TẠO REEL
              </div>
            ) : item.video_status === 'FAILED' ? (
              <div 
                className="pointer-events-auto flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-bold text-red-300 backdrop-blur-md shadow-md cursor-help"
                title={`Muse tạo video thất bại: ${item.error_log || 'Lỗi không xác định'}`}
              >
                <span className="material-symbols-outlined text-xs text-red-400">error</span>
                LỖI TẠO REEL
              </div>
            ) : null}
          </div>

          {isRendering ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center space-y-2 bg-fb-bg/80">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center text-white shadow-lg animate-pulse">
                <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
              </div>
              <p className="text-xs text-cyan-300 font-bold">Đang khởi tạo ảnh 2K AI...</p>
            </div>
          ) : isFailed && !hasImage ? (
            <div className="absolute inset-0 bg-rose-950/70 flex flex-col items-center justify-center p-4 text-center space-y-2 text-rose-300">
              <span className="material-symbols-outlined text-3xl text-rose-400">warning</span>
              <span className="text-xs font-bold">Khởi tạo ảnh thất bại</span>
              {item.error_log && (
                <p className="text-[10px] text-rose-300/80 max-w-xs line-clamp-2 px-2">
                  {item.error_log}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                {onUseOriginalImage && (
                  <button
                    type="button"
                    onClick={() => onUseOriginalImage(item)}
                    className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-full text-xs font-semibold text-cyan-200 border border-cyan-500/30 transition-all flex items-center gap-1 cursor-pointer"
                    title="Tự động lấy ảnh gốc từ website làm chuẩn để tạo Video Reel"
                  >
                    <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                    Dùng ảnh gốc làm Video
                  </button>
                )}
                {onRetry && (
                  <button
                    type="button"
                    onClick={() => onRetry(item)}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/40 rounded-full text-xs font-semibold text-rose-200 border border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">refresh</span>
                    Thử lại
                  </button>
                )}
              </div>
            </div>
          ) : item.video_url && showVideo ? (
            <div className="w-full h-full relative bg-black flex items-center justify-center">
              <video
                src={item.video_url}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          ) : item.image_url ? (
            <div
              className="w-full h-full cursor-pointer overflow-hidden relative"
              onClick={() => {
                if (onZoom) {
                  onZoom(item.image_url);
                } else {
                  window.open(item.image_url, '_blank');
                }
              }}
              title="Click để xem ảnh phóng to"
            >
              <img
                src={item.image_url}
                alt={item.wp_post_title || '2K Image'}
                className="w-full h-full object-cover group-hover/media:scale-105 transition-transform duration-500"
                onError={(e: any) => {
                  e.target.onerror = null;
                  e.target.src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="%2364748b" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                }}
              />
              {/** ZTTeam: Nếu bị lỗi đăng Facebook nhưng ảnh đã có: Hiển thị banner cảnh báo dưới chân ảnh */}
              {isFailed && (
                <div className="absolute inset-x-0 bottom-0 bg-rose-950/90 backdrop-blur-sm p-2 text-rose-200 text-[10px] flex items-center gap-1.5 shadow-md">
                  <span className="material-symbols-outlined text-sm text-rose-400 shrink-0">error</span>
                  <span className="truncate flex-1 font-medium">{item.error_log || 'Lỗi xuất bản Facebook'}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/media:opacity-100">
                <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">zoom_in</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-fb-text-muted text-xs">
              <span className="material-symbols-outlined text-3xl mb-1">image_not_supported</span>
              <span>Chưa có ảnh media</span>
            </div>
          )}
        </div>
      </div>

      {/** 5. Story Hook / Part 1 Content with Expand Option */}
      <div className="px-4 py-2">
        <div
          className={`text-xs text-fb-text/90 leading-relaxed font-normal whitespace-pre-line ${
            isExpanded ? '' : 'line-clamp-3'
          }`}
        >
          {storyContent}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 transition-colors p-0 cursor-pointer"
          >
            <span>{isExpanded ? 'Thu gọn' : 'Xem thêm nội dung'}</span>
            <span className="material-symbols-outlined text-[14px]">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {item.wp_post_url && (
            <a
              href={item.wp_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold text-fb-text-muted hover:text-blue-400 flex items-center gap-0.5 transition-colors"
            >
              <span>Đọc bài gốc</span>
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          )}
        </div>
      </div>

      {/** 6. Two-Step Delayed Comment Preview (Mô phỏng 2 tầng bình luận Facebook) */}
      <div className="mx-4 mb-3 p-3 bg-fb-surface-hover/80 rounded-xl border border-white/5 space-y-3">
        {/** Tầng 1: Bình luận mồi YES (T = 60 phút) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-fb-text">
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              <span>Bình luận 1: Mồi kích hoạt (Sau 1h)</span>
            </div>

            {isAlreadyPosted ? (
              item.comment_step >= 1 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">check</span>
                  Đã thả mồi
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">hourglass_top</span>
                  Chờ đủ 1h
                </span>
              )
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-fb-text-muted border border-white/10 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                Tự động sau 1h
              </span>
            )}
          </div>

          <p className="text-[11px] text-blue-200/90 bg-blue-950/40 p-2 rounded-lg border border-blue-500/20 select-all leading-relaxed italic">
            ...I know you're all very curious about what happens next, so if you want to read on, leave "YES" in the comments below! 👇
          </p>
        </div>

        {/** Tầng 2: Bình luận lồng nhau Reply Part 2 & Link (T = 75 phút) */}
        <div className="ml-3 pl-2.5 border-l-2 border-blue-500/30 space-y-1.5">
          <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-fb-text">
            <div className="flex items-center gap-1 text-cyan-400">
              <span className="material-symbols-outlined text-[14px]">reply</span>
              <span>Bình luận 2: Trả lời Part 2 & Link (Sau 15p)</span>
            </div>

            {isAlreadyPosted ? (
              item.comment_step === 2 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">done_all</span>
                  Đã trả lời
                </span>
              ) : item.comment_step === 1 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                  Chờ 15p
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-fb-text-muted border border-white/10 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
                  Chờ bước 1
                </span>
              )
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-fb-text-muted border border-white/10 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">schedule</span>
                Tự động sau 75p
              </span>
            )}
          </div>

          <p className="text-[11px] text-fb-text-muted line-clamp-4 whitespace-pre-line select-all leading-relaxed bg-black/30 p-2 rounded-lg border border-white/5 font-mono">
            {item.ai_first_comment ||
              `👉 FULL STORY HERE 👇👇👇\n${item.wp_post_url || 'https://thieponline.store'}`}
          </p>
        </div>
      </div>

      {/** 7. Actions Footer Bar */}
      <div className="mt-auto px-4 py-3 bg-fb-bg/60 border-t border-fb-surface-hover/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1">
          {/** Button Đăng Ngay: CHỈ HIỂN THỊ KHI CHƯA ĐĂNG */}
          {canPostNow && onPostNow && (
            <button
              type="button"
              onClick={() => onPostNow(item)}
              disabled={isPosting}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              title="Đăng bài lên Facebook ngay"
            >
              {isPosting ? (
                <>
                  <span className="material-symbols-outlined text-[15px] animate-spin">sync</span>
                  <span>Đang đăng...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[15px]">send</span>
                  <span>Đăng Ngay</span>
                </>
              )}
            </button>
          )}

          {/** Khi ĐÃ ĐĂNG: Hiển thị badge và nút Xem trên FB */}
          {isAlreadyPosted && (
            <div className="flex items-center gap-2 flex-1">
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                <span>Đã đăng</span>
              </span>
              {item.fb_post_id && resolvedFbPageId && (
                <a
                  href={`https://www.facebook.com/${resolvedFbPageId}/posts/${item.fb_post_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 truncate"
                  title="Xem bài viết trên Facebook"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  <span>Xem trên FB</span>
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {item.image_url && (
            <a
              href={item.image_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg bg-fb-surface-hover hover:bg-fb-surface-hover/80 text-fb-text-muted hover:text-white transition-all flex items-center justify-center border border-white/5"
              title="Tải ảnh về máy"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
            </a>
          )}

          {isCompleted && !item.video_url && item.video_status !== 'PENDING' && onQueueVideo && (
            <button
              type="button"
              onClick={() => onQueueVideo(item)}
              className={`w-8 h-8 rounded-lg transition-all flex items-center justify-center border cursor-pointer shadow-sm ${
                item.video_status === 'FAILED'
                  ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/30 animate-pulse'
                  : 'bg-fb-surface-hover border-white/5 text-fb-text-muted hover:bg-amber-500/20 hover:text-amber-300'
              }`}
              title={
                item.video_status === 'FAILED'
                  ? `Muse tạo video bị lỗi: ${item.error_log || 'Thất bại'}. Bấm để thử lại tạo video Reel!`
                  : "Đưa bài viết vào hàng đợi tạo Video Reel 15s (Muse AI)"
              }
            >
              <span className="material-symbols-outlined text-[16px]">
                {item.video_status === 'FAILED' ? 'replay' : 'movie'}
              </span>
            </button>
          )}

          {(isFailed || item.status === 'COMPLETED') && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(item)}
              className="w-8 h-8 rounded-lg bg-fb-surface-hover hover:bg-amber-500/20 text-fb-text-muted hover:text-amber-300 transition-all flex items-center justify-center border border-white/5 cursor-pointer"
              title={hasImage ? "Làm mới lại khung giờ xuất bản (giữ nguyên ảnh)" : "Tạo lại ảnh bằng AI"}
            >
              <span className="material-symbols-outlined text-[16px]">schedule</span>
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="w-8 h-8 rounded-lg bg-fb-surface-hover hover:bg-rose-500/20 text-fb-text-muted hover:text-rose-400 transition-all flex items-center justify-center border border-white/5 cursor-pointer"
              title="Xóa khỏi hàng đợi"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
