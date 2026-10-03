import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import CustomDropdown from './CustomDropdown';

/**
 * Build preview HTML from template data — exported so other components
 * (e.g. mini preview cards) can reuse the same rendering logic.
 */
export function ztteam_buildTemplateHtml(data: any): string {
  let html = data.html_content || '';

  html = html.replace(/{{#if colors\.danger}}{{colors\.danger}}{{else}}{{colors\.primary}}{{\/if}}/g, '#ef4444');
  html = html.replace(/{{#if colors\.primary}}{{colors\.primary}}{{else}}#1877f2{{\/if}}/g, '#1877f2');
  
  const videoX = data.layout?.video?.x ?? 0;
  const videoW = data.layout?.video?.w ?? 1080;
  const videoH = data.layout?.video?.h ?? 1080;
  
  html = html.replace(/{{video_area\.x}}/g, String(videoX));
  html = html.replace(/{{video_area\.y}}/g, String(data.video_y || 0));
  html = html.replace(/{{video_area\.w}}/g, String(videoW));
  html = html.replace(/{{video_area\.h}}/g, String(videoH));
  html = html.replace(/{{video_area\.radius}}/g, String(data.video_radius || 0));

  html = html.replace(/position:\s*absolute;\s*left:\s*40px;\s*right:\s*40px;/g, 'position: absolute; left: {{layout.breaking.x}}px; top: {{layout.breaking.y}}px; width: 1000px;');

  const headerX = data.layout?.header?.x !== undefined ? data.layout.header.x : 84;
  const headerY = data.layout?.header?.y !== undefined ? data.layout.header.y : 1362;
  html = html.replace(/{{layout\.header\.x}}/g, String(headerX));
  html = html.replace(/{{layout\.header\.y}}/g, String(headerY));

  const breakingX = data.layout?.breaking?.x !== undefined ? data.layout.breaking.x : 40;
  const breakingY = data.layout?.breaking?.y !== undefined ? data.layout.breaking.y : 26;
  html = html.replace(/{{layout\.breaking\.x}}/g, String(breakingX));
  html = html.replace(/{{layout\.breaking\.y}}/g, String(breakingY));

  const chevronsX = data.layout?.chevrons?.x !== undefined ? data.layout.chevrons.x : 720;
  const chevronsY = data.layout?.chevrons?.y !== undefined ? data.layout.chevrons.y : 1330;
  html = html.replace(/{{layout\.chevrons\.x}}/g, String(chevronsX));
  html = html.replace(/{{layout\.chevrons\.y}}/g, String(chevronsY));

  const hookX = data.layout?.hook?.x !== undefined ? data.layout.hook.x : 90;
  const hookY = data.layout?.hook?.y !== undefined ? data.layout.hook.y : 1450;
  html = html.replace(/{{layout\.hook\.x}}/g, String(hookX));
  html = html.replace(/{{layout\.hook\.y}}/g, String(hookY));

  const verdictX = data.layout?.verdict?.x !== undefined ? data.layout.verdict.x : 90;
  const verdictY = data.layout?.verdict?.y !== undefined ? data.layout.verdict.y : 1700;
  html = html.replace(/{{layout\.verdict\.x}}/g, String(verdictX));
  html = html.replace(/{{layout\.verdict\.y}}/g, String(verdictY));

  const subtitlesX = data.layout?.subtitles?.x !== undefined ? data.layout.subtitles.x : 40;
  const subtitlesY = data.layout?.subtitles?.y !== undefined ? data.layout.subtitles.y : 1550;
  html = html.replace(/{{layout\.subtitles\.x}}/g, String(subtitlesX));
  html = html.replace(/{{layout\.subtitles\.y}}/g, String(subtitlesY));

  html = html.replace(/{{{logoSvg}}}/g, '<div style="background:#ddd;width:100%;height:100%"></div>');
  html = html.replace(/{{fanpageName}}/g, 'Fanpage Demo');

  const displayTitle = data.test_title || 'Tiêu đề bài viết nổi bật, thu hút sự chú ý của người xem ngay lập tức';

  html = html.replace(/{{#each hook}}<span class="line{{#if @first}} accent{{\/if}}">{{this}}{{#unless @last}}&#32;{{\/unless}}<\/span>{{\/each}}/g, `<span class="line accent">${displayTitle}</span>`);
  html = html.replace(/{{#each hook}}<span>{{this}} <\/span>{{\/each}}/g, `<span class="line accent">${displayTitle}</span>`);

  /** Image Template Fallbacks or External Data */
  const img1 = data.test_images?.[0] || 'https://picsum.photos/seed/1/1080/1080';
  const img2 = data.test_images?.[1] || 'https://picsum.photos/seed/2/1080/1080';
  const img3 = data.test_images?.[2] || 'https://picsum.photos/seed/3/1080/1080';
  const img4 = data.test_images?.[3] || 'https://picsum.photos/seed/4/1080/1080';
  const img5 = data.test_images?.[4] || 'https://picsum.photos/seed/5/1080/1080';

  html = html.replace(/{{image_1}}/g, img1);
  html = html.replace(/{{image_2}}/g, img2);
  html = html.replace(/{{image_3}}/g, img3);
  html = html.replace(/{{image_4}}/g, img4);
  html = html.replace(/{{image_5}}/g, img5);

  /** Handlebars syntax fallback for Breaking News Modern */
  html = html.replace(/{{#each hook}}<span class="line">{{this}}<\/span><br\/>{{\/each}}/g, `<span class="line accent">${displayTitle}</span>`);

  /** Replace news variables for preview */
  html = html.replace(/{{title}}/g, displayTitle);
  html = html.replace(/{{excerpt}}/g, 'Đoạn mô tả ngắn gọn về nội dung bài viết, giúp người dùng nắm bắt thông tin cơ bản trước khi click vào xem chi tiết.');
  html = html.replace(/{{site_name}}/g, 'Kênh Tin Tức 24h');

  /** Handle hiding elements */
  if (data.layout?.hide_title) {
    html = html.replace(/class="header"/g, 'class="header" style="display: none !important;"');
    html = html.replace(/class="text-overlay"/g, 'class="text-overlay" style="display: none !important;"');
  }
  if (data.layout?.hide_excerpt) {
    html = html.replace(/class="hook"/g, 'class="hook" style="display: none !important;"');
  }
  const fontFaceImport = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;600;700;800;900&display=swap');</style>`;
  html = html.replace(/{{{fontFace}}}/g, fontFaceImport);
  
  /** Inject custom colors */
  const headerColor = data.layout?.header_color;
  if (headerColor) {
    html = html.replace(/\.header\s*\.pname\s*{([^}]*?)}/g, `.header .pname { $1 color: ${headerColor} !important; }`);
  }
  const hookColor = data.layout?.hook_color;
  if (hookColor) {
    html = html.replace(/\.hook\s*\.line\s*{([^}]*?)}/g, `.hook .line { $1 color: ${hookColor} !important; }`);
    html = html.replace(/\.hook\s*{([^}]*?)}/g, `.hook { $1 color: ${hookColor} !important; }`);
  }
  
  /** Inject uploaded bg image URL */
  if (data.layout?.bg_image_url && !html.includes('class="bg-img"')) {
    html = html.replace(/<div class="stage">/g, `<div class="stage">\n  <img class="bg-img" src="${data.layout.bg_image_url}" style="position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; z-index: -1;" />`);
  }
  html = html.replace(/{{layout\.bg_image_url}}/g, data.layout?.bg_image_url || '');
  if (!data.layout?.bg_image_url) {
    html = html.replace(/{{#unless layout\.bg_image_url}}display:none;{{\/unless}}/g, 'display:none;');
  } else {
    html = html.replace(/{{#unless layout\.bg_image_url}}display:none;{{\/unless}}/g, '');
  }

  /** Force subtitles to show in preview */
  html = html.replace(/\.subtitles-preview\s*\{([^}]*?)display:\s*none;([^}]*?)\}/g, '.subtitles-preview { $1 display: block; $2 }');

  html = html.replace(/pointer-events:\s*none;/g, 'pointer-events: auto;');
  
  html = html.replace(/html,\s*body\s*{/g, '.stage {');
  html = html.replace(/body\s*{/g, '.stage {');
  html = html.replace(/\*\s*{/g, '.stage * {');
  html = html.replace(/:root\s*{/g, '.stage {');

  /** Add visual styling for video frame in previews */
  html = html.replace(/class="video-frame"/g, 'class="video-frame" style="z-index: 50 !important; box-shadow: inset 0 0 0 2px rgba(24, 119, 242, 0.5) !important; background-color: rgba(24, 119, 242, 0.15) !important;"');

  return html;
}

export function TemplateMiniPreview({ templateData }: { templateData: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isImage = templateData.format === 'image';
  const stageWidth = 1080;
  const stageHeight = isImage ? 1080 : 1920;
  const [scale, setScale] = useState(0.1);

  const html = useMemo(() => ztteam_buildTemplateHtml(templateData), [
    templateData.html_content, templateData.video_y, templateData.video_radius,
    templateData.layout
  ]);

  useEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          if (entry.contentRect.width > 0) {
            setScale(entry.contentRect.width / stageWidth);
          }
        }
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [stageWidth]);

  useEffect(() => {
    if (ref.current) {
      let shadow = ref.current.shadowRoot;
      if (!shadow) {
        shadow = ref.current.attachShadow({ mode: 'open' });
      }
      shadow.innerHTML = `<div class="stage" style="width: ${stageWidth}px; height: ${stageHeight}px; position: relative; overflow: hidden;">${html}</div>`;
    }
  }, [html, stageWidth, stageHeight]);

  return (
    <div ref={containerRef} className="relative w-full h-full rounded-lg overflow-hidden bg-fb-surface flex items-center justify-center">
      <div
        ref={ref}
        className="absolute top-0 left-0 template-preview-wrapper"
        style={{ width: `${stageWidth}px`, height: `${stageHeight}px`, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }}
      />
    </div>
  );
}

interface ReelTemplateEditorProps {
  initialData: any;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  onChange?: (data: any) => void;
  isOverrideMode?: boolean;
}

export default function ReelTemplateEditor({ initialData, onSave, onCancel, onDelete, onChange, isOverrideMode = false }: ReelTemplateEditorProps) {
  const [formData, setFormData] = useState({
    ...initialData,
    video_y: initialData.video_y || 0,
    video_radius: initialData.video_radius || 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'content' | 'render'>('content');
  const [playing, setPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { ztteam_showToast } = useUIStore();
  
  const handleUploadBgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    try {
      setIsUploading(true);
      const fd = new FormData();
      fd.append('file', file);
      
      const endpoint = formData.id ? `templates/${formData.id}/upload-bg` : `templates/upload-bg`;
      const res = await api.post(endpoint, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newUrl = res.data.url;
      const updatedData = {
        ...formData,
        layout: {
          ...(formData.layout || {}),
          bg_image_url: newUrl
        }
      };
      setFormData(updatedData);
      if (onChange) onChange(updatedData);
      ztteam_showToast('Tải ảnh nền thành công', 'success');
    } catch (err) {
      ztteam_showToast('Lỗi khi tải ảnh', 'error');
    } finally {
      setIsUploading(false);
      /** Reset input */
      e.target.value = '';
    }
  };
  
  useEffect(() => {
    setFormData(initialData);
  }, [initialData.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const newData = { ...formData, [e.target.name]: e.target.type === 'number' ? Number(e.target.value) : e.target.value };
    setFormData(newData);
    if (onChange) onChange(newData);
  };

  
  const handleSaveClick = async () => {
    try {
      setIsSaving(true);
      await onSave(formData);
    } catch (error) {
      ztteam_showToast('Lỗi khi lưu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const testTTS = async () => {
    try {
      setPlaying(true);
      const res = await api.post('templates/tts/test', {
        voice: formData.voice_id || 'alloy',
        text: 'Đây là bản nghe thử giọng đọc mẫu trên hệ thống của bạn.'
      });
      if (audioRef.current) {
        audioRef.current.src = res.data.url;
        audioRef.current.play();
        audioRef.current.onended = () => setPlaying(false);
      }
    } catch (error: any) {
      setPlaying(false);
      ztteam_showToast(error.response?.data?.message || 'Lỗi phát âm thanh', 'error');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row w-full gap-8">
      {/* Left Settings Panel */}
      <div className="w-full lg:w-3/5 space-y-6">
        
        {/* TABS */}
        <div className="flex border-b border-fb-surface-hover/50">
          <button 
            onClick={() => setActiveTab('content')}
            className={`px-6 py-4 font-black text-sm transition-colors border-b-2 ${activeTab === 'content' ? 'border-fb-blue text-fb-blue' : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/30'}`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">article</span>
              Thiết lập Nội dung & AI
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('render')}
            className={`px-6 py-4 font-black text-sm transition-colors border-b-2 ${activeTab === 'render' ? 'border-fb-blue text-fb-blue' : 'border-transparent text-fb-text-muted hover:text-fb-text hover:bg-fb-surface-hover/30'}`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">palette</span>
              Giao diện Render
            </div>
          </button>
        </div>

        <div className="bg-fb-surface rounded-2xl shadow-lg p-6 border border-fb-surface-hover/50 space-y-6">
          {activeTab === 'content' && (
            <div className="space-y-6 animate-in fade-in duration-200">
               {/* NAME */}
               {!isOverrideMode && (
                 <div>
                   <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-2">Tên template <span className="text-red-500">*</span></label>
                   <input name="name" value={formData.name || ''} onChange={handleChange} className="w-full bg-fb-surface-hover text-fb-text border border-fb-surface-hover/50 focus:outline-none focus:ring-0 focus:border-fb-blue rounded-xl px-4 py-2.5 transition-colors text-sm font-semibold" />
                 </div>
               )}
               {/* CONTENT TYPE (Video) */}
               {formData.format === 'video' && (
                 <div>
                   <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-2">Dạng nội dung <span className="text-red-500">*</span></label>
                   <CustomDropdown 
                     value={formData.content_type || ''} 
                     onChange={(v) => {
                       const newData = { ...formData, content_type: v };
                       setFormData(newData);
                       if (onChange) onChange(newData);
                     }}
                     options={[
                       { value: 'myth', label: '3 sự thật (MYTH)' },
                       { value: 'benefit', label: '3 lợi ích (BENEFIT)' },
                       { value: 'cliffhanger', label: 'Tranh cãi (CLIFFHANGER)' },
                       { value: 'showdown', label: 'Chọn phe (SHOWDOWN)' },
                       { value: 'teaser', label: 'Tin nóng 5s (TEASER)' }
                     ]}
                   />
                 </div>
               )}
               {/* VOICE */}
               {formData.format === 'video' && (
                 <div className="flex gap-4">
                   <div className="flex-1">
                     <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-2">Giọng đọc riêng <span className="text-red-500">*</span></label>
                     <CustomDropdown 
                       value={formData.voice_id || ''} 
                       onChange={(v) => {
                         const newData = { ...formData, voice_id: v };
                         setFormData(newData);
                         if (onChange) onChange(newData);
                       }}
                       options={[
                         { value: '', label: '(theo Cài đặt chung)' },
                         { value: '3001', label: 'Linh (CapCut Nữ - Tự nhiên)' },
                         { value: '8001', label: 'Ngọc Huyền (CapCut Nữ - Hiện đại)' },
                         { value: 'onyx', label: 'Onyx (Nam, trầm ấm)' },
                         { value: 'alloy', label: 'Alloy (Nam, trung tính)' },
                         { value: 'echo', label: 'Echo (Nam, ấm áp)' },
                         { value: 'fable', label: 'Fable (Nam, Anh-Anh)' },
                         { value: 'nova', label: 'Nova (Nữ, năng động)' },
                         { value: 'shimmer', label: 'Shimmer (Nữ, nhẹ nhàng)' }
                       ]}
                     />
                   </div>
                   <div className="flex items-end">
                     <button 
                       type="button" 
                       onClick={testTTS}
                       disabled={playing}
                       className="mb-0 text-sm bg-fb-blue/15 text-fb-blue hover:bg-fb-blue/25 font-bold flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 h-[42px]"
                     >
                       <span className="material-symbols-outlined text-[18px]">{playing ? 'graphic_eq' : 'volume_up'}</span> 
                       {playing ? 'Đang phát' : 'Nghe thử'}
                     </button>
                   </div>
                 </div>
               )}

               {/* TOGGLES */}
               <div>
                  <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-3">Tuỳ chọn hiển thị</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-4 bg-fb-surface-hover/30 rounded-xl border border-fb-surface-hover/50 hover:border-fb-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-bold text-fb-text">Hiển thị Tiêu đề (Header)</p>
                        <p className="text-[11px] font-medium text-fb-text-muted mt-0.5">Hiển thị thanh tiêu đề màu phía trên.</p>
                      </div>
                      <div className="cursor-pointer shrink-0" onClick={() => {
                        const newData = { ...formData, layout: { ...formData.layout, hide_title: !(!formData.layout?.hide_title) } };
                        setFormData(newData);
                        if (onChange) onChange(newData);
                      }}>
                        <button className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!formData.layout?.hide_title ? 'bg-fb-blue' : 'bg-fb-surface-hover/80'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${!formData.layout?.hide_title ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-fb-surface-hover/30 rounded-xl border border-fb-surface-hover/50 hover:border-fb-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-bold text-fb-text">Hiển thị Mô tả (Hook)</p>
                        <p className="text-[11px] font-medium text-fb-text-muted mt-0.5">Hiển thị đoạn chữ nhử mồi ở giữa video.</p>
                      </div>
                      <div className="cursor-pointer shrink-0" onClick={() => {
                        const newData = { ...formData, layout: { ...formData.layout, hide_excerpt: !(!formData.layout?.hide_excerpt) } };
                        setFormData(newData);
                        if (onChange) onChange(newData);
                      }}>
                        <button className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!formData.layout?.hide_excerpt ? 'bg-fb-blue' : 'bg-fb-surface-hover/80'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${!formData.layout?.hide_excerpt ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
               </div>

            </div>
          )}

          {activeTab === 'render' && (
            <div className="space-y-6 animate-in fade-in duration-200">
               {/* RADIUS */}
               <div>
                 <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-2">Bo góc {formData.format === 'image' ? 'ảnh' : 'video'}</label>
                 <input type="number" name="video_radius" value={formData.video_radius || 0} onChange={handleChange} className="w-full bg-fb-surface-hover text-fb-text border border-fb-surface-hover/50 focus:outline-none focus:ring-0 focus:border-fb-blue rounded-xl px-4 py-2.5 transition-colors text-sm font-semibold" />
               </div>

               {/* COLORS */}
               <div>
                  <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-3">Màu sắc tuỳ chỉnh</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 bg-fb-surface-hover/30 rounded-xl border border-fb-surface-hover/50">
                      <span className="text-sm font-bold text-fb-text">Tên Fanpage</span>
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-fb-surface-hover ring-2 ring-transparent focus-within:ring-fb-blue cursor-pointer shadow-sm">
                        <input type="color" value={formData.layout?.header_color || '#ffffff'} onChange={(e) => {
                          const newData = { ...formData, layout: { ...formData.layout, header_color: e.target.value } };
                          setFormData(newData);
                          if (onChange) onChange(newData);
                        }} className="absolute -inset-4 w-16 h-16 cursor-pointer" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-fb-surface-hover/30 rounded-xl border border-fb-surface-hover/50">
                      <span className="text-sm font-bold text-fb-text">Tiêu đề (Hook)</span>
                      <div className="relative w-8 h-8 rounded-full overflow-hidden border-2 border-fb-surface-hover ring-2 ring-transparent focus-within:ring-fb-blue cursor-pointer shadow-sm">
                        <input type="color" value={formData.layout?.hook_color || '#ffffff'} onChange={(e) => {
                          const newData = { ...formData, layout: { ...formData.layout, hook_color: e.target.value } };
                          setFormData(newData);
                          if (onChange) onChange(newData);
                        }} className="absolute -inset-4 w-16 h-16 cursor-pointer" />
                      </div>
                    </div>
                  </div>
               </div>

               {/* BG IMAGE */}
               <div>
                 <label className="block text-sm font-bold text-fb-text-muted uppercase tracking-wider text-[10px] mb-2">Giao diện (Ảnh nền 1080x1920)</label>
                 <div className="flex gap-2">
                   <input type="file" accept="image/png, image/jpeg" onChange={handleUploadBgImage} className="hidden" id="bg-upload" />
                   <label htmlFor="bg-upload" className="flex-1 bg-fb-blue/15 hover:bg-fb-blue/25 text-fb-blue px-5 py-3 rounded-xl font-bold transition-all cursor-pointer flex items-center justify-center gap-2 border border-fb-blue/20">
                     <span className="material-symbols-outlined text-[20px]">upload</span>
                     {isUploading ? 'Đang tải lên...' : 'Tải lên Ảnh nền Template'}
                   </label>
                   {formData.layout?.bg_image_url && (
                     <button type="button" onClick={() => {
                       const newLayout = { ...formData.layout };
                       delete newLayout.bg_image_url;
                       setFormData({ ...formData, layout: newLayout });
                     }} className="w-12 h-12 bg-red-500/15 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500/25 flex-shrink-0" title="Xoá ảnh nền">
                       <span className="material-symbols-outlined text-[20px]">delete</span>
                     </button>
                   )}
                 </div>
                 {formData.layout?.bg_image_url && (
                   <p className="text-xs text-emerald-400 font-bold mt-2 pl-1 flex items-center gap-1">
                     <span className="material-symbols-outlined text-[14px]">check_circle</span> Đã áp dụng ảnh nền tuỳ chỉnh.
                   </p>
                 )}
               </div>
            </div>
          )}

          {/* FOOTER ACTIONS */}
          <div className="pt-6 mt-6 border-t border-fb-surface-hover/50 flex gap-3 justify-end items-center">
            {!isOverrideMode && formData.is_default !== true && onDelete && (
               <button type="button" onClick={onDelete} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 py-2.5 rounded-xl font-bold transition-all mr-auto flex items-center gap-1.5 border border-red-500/20">
                 <span className="material-symbols-outlined text-[18px]">delete</span> Xóa Template
               </button>
            )}
            {isOverrideMode && onCancel && (
              <button type="button" onClick={onCancel} className="bg-fb-surface-hover hover:bg-fb-surface-hover/80 text-fb-text px-6 py-2.5 rounded-xl font-bold transition-all border border-fb-surface-hover">
                 Hủy bỏ
              </button>
            )}
            <button onClick={handleSaveClick} disabled={isSaving} className="bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 disabled:opacity-50">
              {isSaving ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
              Lưu Thiết Lập
            </button>
          </div>
        </div>

      </div>

      <audio ref={audioRef} className="hidden" />

      {/* Right Preview Panel (Sticky) */}
      <div className="w-full lg:w-2/5">
        <div className="sticky top-6">
          <div className="bg-fb-surface rounded-2xl shadow-xl border border-fb-surface-hover/50 overflow-hidden">
            <div className="bg-fb-surface-hover/30 px-5 py-3.5 flex items-center justify-between border-b border-fb-surface-hover/50">
              <h4 className="text-sm font-bold text-fb-text flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-fb-blue">preview</span>
                Preview (Xem trước)
              </h4>
            </div>
            
            {/* The preview canvas area with a dot pattern background to feel like an editor */}
            <div className="p-6 flex flex-col items-center bg-[#0b1326] relative">
              <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
              <div className="relative rounded-2xl overflow-hidden ring-4 ring-fb-surface-hover/80 shadow-2xl mx-auto z-10 bg-fb-bg" style={{ width: '270px', height: formData.format === 'image' ? '270px' : '480px', transformOrigin: 'top center' }}>
                 <PreviewCanvas formData={formData} setFormData={setFormData} onChange={onChange} />
              </div>
              
              <div className="z-10 mt-5 bg-fb-surface/80 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-fb-surface-hover/50 flex items-start gap-2 max-w-[270px]">
                <span className="material-symbols-outlined text-fb-blue text-[18px] shrink-0 mt-0.5">info</span>
                <p className="text-[11px] font-medium text-fb-text-muted leading-relaxed">
                  {formData.format === 'image' 
                    ? 'Kéo khung để đặt vị trí ảnh. Kéo góc phải bên dưới khung xanh để thay đổi kích thước.'
                    : 'Kéo các khung chữ để chỉnh vị trí thành phần.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}function PreviewCanvas({ formData, setFormData, onChange }: { formData: any, setFormData: any, onChange?: (data: any) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  /**
   * Use a ref to always have the latest formData available in event handlers
   * without needing formData in the useEffect dependency array.
   * This prevents the entire DOM from being destroyed/recreated on every drag end.
   */
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  
  /**
   * Build the drag-enabled preview HTML (adds data-drag-id attributes on top of base HTML).
   */
  const buildDragHtml = (data: any): string => {
    let html = ztteam_buildTemplateHtml(data);
    
    /** Add drag IDs to interactive elements */
    html = html.replace(/class="header"/g, 'class="header" data-drag-id="header"');
    html = html.replace(/class="breaking"/g, 'class="breaking" data-drag-id="breaking"');
    html = html.replace(/class="chevrons"/g, 'class="chevrons" data-drag-id="chevrons"');
    html = html.replace(/class="hook"/g, 'class="hook" data-drag-id="hook"');
    html = html.replace(/class="subtitles-preview"/g, 'class="subtitles-preview" data-drag-id="subtitles"');
    
    /** Make video-frame draggable */
    html = html.replace(/class="video-frame"/g, 'class="video-frame" data-drag-id="video"');

    return html;
  };

  /**
   * Attach drag listeners. This runs once on mount and again only when
   * html_content itself changes (template switch), NOT on layout changes.
   */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    /** Render the drag-enabled HTML into the container */
    const html = buildDragHtml(formData);
    container.innerHTML = html;

    /** Find all draggable elements and set up handlers */
    const setupDrag = () => {
      const draggables = container.querySelectorAll('[data-drag-id]');

      draggables.forEach(el => {
        const element = el as HTMLElement;
        element.style.cursor = 'move';
        element.style.outline = '2px dashed #1877f2';
        element.ondragstart = () => false;

        const id = element.getAttribute('data-drag-id');
        if (id === 'video' && !element.querySelector('.resize-handle')) {
          const handle = document.createElement('div');
          handle.className = 'resize-handle';
          handle.style.position = 'absolute';
          handle.style.right = '-20px';
          handle.style.bottom = '-20px';
          handle.style.width = '40px';
          handle.style.height = '40px';
          handle.style.background = '#1877f2';
          handle.style.border = '4px solid white';
          handle.style.borderRadius = '50%';
          handle.style.cursor = 'nwse-resize';
          handle.style.zIndex = '10000';
          handle.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          
          handle.onmousedown = (e: any) => {
            e.stopPropagation();
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const currentData = formDataRef.current;
            const initialW = currentData.layout?.video?.w ?? 1080;
            const initialH = currentData.layout?.video?.h ?? 1080;
            
            const onMove = (moveE: any) => {
               const dx = (moveE.clientX - startX) / 0.25;
               const dy = (moveE.clientY - startY) / 0.25;
               element.style.width = `${initialW + dx}px`;
               element.style.height = `${initialH + dy}px`;
            };
            const onUp = (upE: any) => {
               document.removeEventListener('mousemove', onMove);
               document.removeEventListener('mouseup', onUp);
               const dx = (upE.clientX - startX) / 0.25;
               const dy = (upE.clientY - startY) / 0.25;
               setFormData((prev: any) => {
                 const newData = {
                    ...prev,
                    layout: {
                       ...(prev.layout || {}),
                       video: {
                          ...(prev.layout?.video || {}),
                          w: Math.round(initialW + dx),
                          h: Math.round(initialH + dy)
                       }
                    }
                 };
                 if (onChange) setTimeout(() => onChange(newData), 0);
                 return newData;
               });
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
          };
          element.appendChild(handle);
        }

        element.onmousedown = (e: MouseEvent) => {
          const id = element.getAttribute('data-drag-id');
          if (!id) return;
          
          e.preventDefault();
          e.stopPropagation();
          
          document.body.style.userSelect = 'none';
          
          const currentData = formDataRef.current;
          const startX = e.clientX;
          const startY = e.clientY;
            const initialLayoutX = id === 'video' ? (currentData.layout?.video?.x ?? 0) : (currentData.layout?.[id]?.x ?? element.offsetLeft);
            const initialLayoutY = id === 'video' ? (currentData.video_y ?? element.offsetTop) : (currentData.layout?.[id]?.y ?? element.offsetTop);
  
            /** Highlight dragging element */
            element.style.outline = '3px solid #1877f2';
            element.style.zIndex = '9999';

          const onMove = (moveEvent: MouseEvent) => {
            const dx = (moveEvent.clientX - startX) / 0.25;
            const dy = (moveEvent.clientY - startY) / 0.25;
            element.style.transform = `translate(${dx}px, ${dy}px)`;
          };
    
          const onUp = (upEvent: MouseEvent) => {
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            
            /** Reset visual styles */
            element.style.outline = '2px dashed #1877f2';
            element.style.zIndex = '';
            element.style.transform = '';
            
            const dx = (upEvent.clientX - startX) / 0.25;
            const dy = (upEvent.clientY - startY) / 0.25;
            
            /** Only commit if actually moved */
            if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
            
            setFormData((prev: any) => {
              let newData = prev;
              if (id === 'video') {
                newData = { 
                  ...prev, 
                  video_y: Math.round(initialLayoutY + dy),
                  layout: {
                    ...(prev.layout || {}),
                    video: {
                      ...(prev.layout?.video || {}),
                      w: prev.layout?.video?.w ?? 1080,
                      h: prev.layout?.video?.h ?? 1080,
                      x: Math.round(initialLayoutX + dx)
                    }
                  }
                };
              } else {
                newData = {
                  ...prev,
                  layout: {
                    ...prev.layout,
                    [id]: {
                      x: Math.round(initialLayoutX + dx),
                      y: Math.round(initialLayoutY + dy)
                    }
                  }
                };
              }
              if (onChange) setTimeout(() => onChange(newData), 0);
              return newData;
            });
          };
    
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        };
      });
    };

    setupDrag();

    return () => {
      /** Clean up by nullifying onmousedown handlers */
      const draggables = container.querySelectorAll('[data-drag-id]');
      draggables.forEach(el => {
        (el as HTMLElement).onmousedown = null;
      });
    };
  }, [formData.html_content, formData.layout?.bg_image_url]);

  /**
   * When layout values change (video_y, layout.header, etc.) after drag ends,
   * update the positions of the elements in the DOM directly without re-rendering.
   * This keeps the drag handlers alive and avoids the flash/lag.
   */
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    /** Update video-frame position and size */
    const videoEl = container.querySelector('[data-drag-id="video"]') as HTMLElement;
    if (videoEl) {
      videoEl.style.top = `${formData.video_y || 0}px`;
      videoEl.style.left = `${formData.layout?.video?.x ?? 0}px`;
      videoEl.style.width = `${formData.layout?.video?.w ?? 1080}px`;
      videoEl.style.height = `${formData.layout?.video?.h ?? 1080}px`;
      videoEl.style.borderRadius = `${formData.video_radius || 0}px`;
    }

    /** Update header position */
    const headerEl = container.querySelector('[data-drag-id="header"]') as HTMLElement;
    if (headerEl) {
      headerEl.style.left = `${formData.layout?.header?.x || 0}px`;
      headerEl.style.top = `${formData.layout?.header?.y || 0}px`;
    }

    /** Update breaking position */
    const breakingEl = container.querySelector('[data-drag-id="breaking"]') as HTMLElement;
    if (breakingEl) {
      const bx = formData.layout?.breaking?.x !== undefined ? formData.layout.breaking.x : 40;
      const by = formData.layout?.breaking?.y !== undefined ? formData.layout.breaking.y : 26;
      breakingEl.style.left = `${bx}px`;
      breakingEl.style.top = `${by}px`;
    }

    /** Update hook position */
    const hookEl = container.querySelector('[data-drag-id="hook"]') as HTMLElement;
    if (hookEl) {
      hookEl.style.left = `${formData.layout?.hook?.x || 0}px`;
      hookEl.style.top = `${formData.layout?.hook?.y || 0}px`;
    }

    /** Update chevrons position */
    const chevronsEl = container.querySelector('[data-drag-id="chevrons"]') as HTMLElement;
    if (chevronsEl) {
      const cx = formData.layout?.chevrons?.x !== undefined ? formData.layout.chevrons.x : 720;
      const cy = formData.layout?.chevrons?.y !== undefined ? formData.layout.chevrons.y : 1330;
      chevronsEl.style.left = `${cx}px`;
      chevronsEl.style.top = `${cy}px`;
    }

    /** Update verdict position */
    const verdictEl = container.querySelector('[data-drag-id="verdict"]') as HTMLElement;
    if (verdictEl) {
      verdictEl.style.left = `${formData.layout?.verdict?.x || 0}px`;
      verdictEl.style.top = `${formData.layout?.verdict?.y || 0}px`;
    }

    /** Update subtitles position */
    const subtitlesEl = container.querySelector('[data-drag-id="subtitles"]') as HTMLElement;
    if (subtitlesEl) {
      const sx = formData.layout?.subtitles?.x !== undefined ? formData.layout.subtitles.x : 40;
      const sy = formData.layout?.subtitles?.y !== undefined ? formData.layout.subtitles.y : 1550;
      subtitlesEl.style.left = `${sx}px`;
      subtitlesEl.style.top = `${sy}px`;
    }
  }, [formData.video_y, formData.layout, formData.video_radius]);

  return (
    <div 
      ref={containerRef}
      className="absolute top-0 left-0 template-preview-wrapper"
      style={{ width: '1080px', height: '1920px', transform: 'scale(0.25)', transformOrigin: 'top left' }}
    />
  );
}

