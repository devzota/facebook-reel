import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import CustomDropdown from '../components/CustomDropdown';

export interface ZTTeamStorySegment {
  start: number;
  end: number;
  text: string;
}

export interface ZTTeamScriptData {
  hook_en: string;
  segments_en: ZTTeamStorySegment[];
  caption_en: string;
  preview_vi: {
    tieu_de: string;
    tom_tat: string;
    segments_dich: ZTTeamStorySegment[];
  };
}

export interface ZTTeamStorySingleImagePromptResult {
  scene_desc_vi: string;
  image_prompt_en: string;
  caption_en: string;
  first_comment: string;
  aspect_ratio: '4:5' | '1:1' | '16:9';
}

export interface ZTTeamStorySingleImageResult {
  imageUrl: string;
  localPath: string;
  prompt: string;
  seed: number;
  width: number;
  height: number;
  aspect_ratio: string;
}

export interface ZTTeamSampleStory {
  id: string;
  title: string;
  content: string;
  images: string[];
}

export default function StoryTestStudio() {
  const { ztteam_showToast } = useUIStore();

  /** Tab switcher: 'single_image' (default) or 'video_reel' */
  const [activeStudioTab, setActiveStudioTab] = useState<'single_image' | 'video_reel'>('single_image');

  /** Common states */
  const [content, setContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [fetchedArticleTitle, setFetchedArticleTitle] = useState('');
  const [sampleStories, setSampleStories] = useState<ZTTeamSampleStory[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');

  /** Single Image Studio States */
  const [imageStyle, setImageStyle] = useState<'cinematic' | 'mystery_horror' | 'vintage_antique'>('cinematic');
  const [imageAspectRatio, setImageAspectRatio] = useState<'4:5' | '1:1' | '16:9'>('4:5');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isReRenderingImage, setIsReRenderingImage] = useState(false);
  const [singleImagePrompt, setSingleImagePrompt] = useState<ZTTeamStorySingleImagePromptResult | null>(null);
  const [singleImageResult, setSingleImageResult] = useState<ZTTeamStorySingleImageResult | null>(null);
  const [editableImagePrompt, setEditableImagePrompt] = useState<string>('');
  const [imageGenerationError, setImageGenerationError] = useState<string | null>(null);

  /** Video Reel Studio States */
  const [duration, setDuration] = useState<number>(15);
  const [bgmTrack, setBgmTrack] = useState<string>('suspense_dramatic.mp3');
  const [bgmList, setBgmList] = useState<{ id: string; name: string }[]>([]);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [scriptData, setScriptData] = useState<ZTTeamScriptData | null>(null);
  const [renderResult, setRenderResult] = useState<{ videoUrl: string; thumbnailUrl: string; duration: number } | null>(null);

  /** Motion Reel from Single Image States */
  const [isRenderingMotionReel, setIsRenderingMotionReel] = useState(false);
  const [motionVideoResult, setMotionVideoResult] = useState<{
    videoUrl: string;
    thumbnailUrl: string;
    duration: number;
    scriptData?: any;
  } | null>(null);
  const [motionDuration, setMotionDuration] = useState<number>(15);
  const [motionStyle, setMotionStyle] = useState<'ambient_zoom' | 'cinematic_zoom'>('ambient_zoom');
  const [motionBgm, setMotionBgm] = useState<string>('suspense_dramatic.mp3');

  /**
   * Load initial BGM list and sample stories
   */
  useEffect(() => {
    const ztteam_loadInitialData = async () => {
      try {
        const [bgmRes, samplesRes] = await Promise.all([
          api.get('/story-test/bgm-list'),
          api.get('/story-test/sample-stories'),
        ]);
        setBgmList(bgmRes.data || []);
        const samples: ZTTeamSampleStory[] = samplesRes.data || [];
        setSampleStories(samples);
      } catch (err: any) {
        ztteam_showToast('Không thể tải danh sách mẫu thử nghiệm', 'error');
      }
    };
    ztteam_loadInitialData();
  }, []);

  /**
   * Handle fetching article content from the entered source URL
   */
  const ztteam_handleFetchFromUrl = async () => {
    if (!sourceUrl.trim()) {
      ztteam_showToast('Vui lòng nhập link bài viết nguồn.', 'error');
      return;
    }
    setIsFetchingUrl(true);
    setImageGenerationError(null);
    try {
      const res = await api.post('/story-test/fetch-source-url', {
        url: sourceUrl.trim(),
      });
      const data = res.data;
      if (!data || !data.content) {
        throw new Error('Không thể trích xuất nội dung từ đường link này.');
      }
      setContent(data.content);
      setFetchedArticleTitle(data.title || '');
      if (Array.isArray(data.images) && data.images.length > 0) {
        setCurrentImages(data.images);
      }
      setScriptData(null);
      setRenderResult(null);
      setSingleImagePrompt(null);
      setSingleImageResult(null);
      setEditableImagePrompt('');
      ztteam_showToast(`Đã lấy thành công nội dung: "${data.title || 'Bài viết'}"`, 'success');
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Không thể cào dữ liệu từ link này.', 'error');
    } finally {
      setIsFetchingUrl(false);
    }
  };

  /**
   * Handle selecting a sample story (for Video Reel tab)
   */
  const ztteam_handleSelectSample = (sample: ZTTeamSampleStory) => {
    setSelectedSampleId(sample.id);
    setContent(sample.content);
    setCurrentImages(sample.images);
    setScriptData(null);
    setRenderResult(null);
    setSingleImagePrompt(null);
    setSingleImageResult(null);
    setEditableImagePrompt('');
    setImageGenerationError(null);
    ztteam_showToast(`Đã nạp mẫu: "${sample.title}"`, 'info');
  };

  /**
   * Single Image: Generate AI prompt & render 1 image (ChatGPT Image 2K)
   */
  const ztteam_handleGenerateSingleImage = async () => {
    let finalContent = content.trim();

    /** If textarea is empty but link is provided, auto-fetch from URL first */
    if (!finalContent && sourceUrl.trim()) {
      setIsFetchingUrl(true);
      setImageGenerationError(null);
      try {
        const res = await api.post('/story-test/fetch-source-url', {
          url: sourceUrl.trim(),
        });
        const data = res.data;
        if (data && data.content) {
          finalContent = data.content;
          setContent(data.content);
          setFetchedArticleTitle(data.title || '');
          if (Array.isArray(data.images) && data.images.length > 0) {
            setCurrentImages(data.images);
          }
        }
      } catch (err: any) {
        ztteam_showToast('Không thể lấy nội dung từ link nguồn đã nhập.', 'error');
        setIsFetchingUrl(false);
        return;
      } finally {
        setIsFetchingUrl(false);
      }
    }

    if (!finalContent) {
      ztteam_showToast('Vui lòng nhập link nguồn hoặc dán nội dung câu chuyện.', 'error');
      return;
    }

    setIsGeneratingImage(true);
    setImageGenerationError(null);
    setSingleImageResult(null);
    try {
      /** Step 1: Extract story scene prompt */
      const promptRes = await api.post('/story-test/generate-single-image-prompt', {
        content: finalContent,
        style: imageStyle,
        aspectRatio: imageAspectRatio,
      });
      const promptData: ZTTeamStorySingleImagePromptResult = promptRes.data;
      setSingleImagePrompt(promptData);
      setEditableImagePrompt(promptData.image_prompt_en);

      /** Step 2: Render 1 image directly via AI 2K */
      const imgRes = await api.post('/story-test/render-single-image', {
        prompt: promptData.image_prompt_en,
        aspectRatio: imageAspectRatio,
      });
      setSingleImageResult(imgRes.data);
      setImageGenerationError(null);
      ztteam_showToast('Đã tạo 1 ảnh Teaser 2K thành công!', 'success');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Lỗi khi tạo ảnh câu chuyện';
      setImageGenerationError(errorMsg);
      ztteam_showToast(errorMsg, 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  /**
   * Single Image: Re-render image with a new seed or updated prompt via AI
   */
  const ztteam_handleReRenderImage = async () => {
    const promptToUse = editableImagePrompt.trim() || singleImagePrompt?.image_prompt_en;
    if (!promptToUse) {
      ztteam_showToast('Vui lòng nhập prompt tạo ảnh.', 'error');
      return;
    }
    setIsReRenderingImage(true);
    setImageGenerationError(null);
    try {
      const imgRes = await api.post('/story-test/render-single-image', {
        prompt: promptToUse,
        aspectRatio: imageAspectRatio,
      });
      setSingleImageResult(imgRes.data);
      setImageGenerationError(null);
      ztteam_showToast('Đã đổi góc chụp và tạo lại ảnh 2K mới!', 'success');
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Lỗi khi tạo lại ảnh';
      setImageGenerationError(errorMsg);
      ztteam_showToast(errorMsg, 'error');
    } finally {
      setIsReRenderingImage(false);
    }
  };

  /**
   * Handle rendering smooth 9:16 motion reel from single 2K image
   */
  const ztteam_handleRenderMotionReel = async () => {
    if (!singleImageResult) {
      ztteam_showToast('Chưa có ảnh 2K để tạo video Reel', 'error');
      return;
    }
    setIsRenderingMotionReel(true);
    try {
      const res = await api.post('/story-test/render-motion-reel', {
        imageUrl: singleImageResult.imageUrl,
        duration: motionDuration,
        motionStyle,
        bgmTrack: motionBgm,
        content: content.trim() || sourceUrl.trim(),
        scriptData: scriptData || undefined,
      });
      setMotionVideoResult(res.data);
      if (res.data.scriptData && !scriptData) {
        setScriptData(res.data.scriptData);
      }
      ztteam_showToast('Render Video Reel động mượt mà thành công!', 'success');
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || err.message || 'Lỗi khi render video Reel', 'error');
    } finally {
      setIsRenderingMotionReel(false);
    }
  };



  /**
   * Video: Handle generating bilingual story teaser script
   */
  const ztteam_handleGenerateScript = async () => {
    if (!content.trim()) {
      ztteam_showToast('Vui lòng nhập nội dung câu chuyện.', 'error');
      return;
    }
    setIsGeneratingScript(true);
    setRenderResult(null);
    try {
      const res = await api.post('/story-test/generate-script', {
        content: content.trim(),
        duration,
        tone: 'suspense',
      });
      setScriptData(res.data);
      ztteam_showToast('Đã tạo kịch bản Teaser song ngữ thành công!', 'success');
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || 'Lỗi khi tạo kịch bản AI', 'error');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  /**
   * Video: Handle rendering the test video using FFmpeg
   */
  const ztteam_handleRenderVideo = async () => {
    if (!scriptData) {
      ztteam_showToast('Chưa có dữ liệu kịch bản để render video', 'error');
      return;
    }
    setIsRenderingVideo(true);
    try {
      const res = await api.post('/story-test/render-video', {
        scriptData,
        duration,
        images: currentImages,
        bgmTrack,
      });
      setRenderResult(res.data);
      ztteam_showToast('Render video Story Teaser thành công!', 'success');
    } catch (err: any) {
      ztteam_showToast(err.response?.data?.message || 'Lỗi khi render video', 'error');
    } finally {
      setIsRenderingVideo(false);
    }
  };

  /**
   * Video: Handle updating segment text in English
   */
  const ztteam_handleUpdateSegmentText = (index: number, newText: string) => {
    if (!scriptData) return;
    const updated = { ...scriptData };
    updated.segments_en[index].text = newText;
    setScriptData(updated);
  };

  /**
   * Copy text to clipboard
   */
  const ztteam_copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    ztteam_showToast(`Đã sao chép ${label}!`, 'info');
  };

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto pb-12">
      {/** Top Header */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-fb-blue to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 text-white shrink-0">
            <span className="material-symbols-outlined text-3xl">auto_stories</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-fb-blue/20 text-fb-blue rounded-full text-[11px] font-bold tracking-wide">
                STORY TEASER STUDIO (TEST)
              </span>
            </div>
            <h2 className="text-2xl font-black text-fb-text tracking-tight">
              Tạo Teaser Câu Chuyện (Stories)
            </h2>
            <p className="text-xs text-fb-text-muted mt-1">
              Tạo 1 ảnh riêng biệt gây tò mò cực độ cho bài đăng Facebook hoặc xuất bản Video Teaser có nhạc nền BGM
            </p>
          </div>
        </div>

        {/** Tab Switcher */}
        <div className="flex p-1 bg-fb-surface-hover/80 rounded-2xl border border-fb-surface-hover self-start md:self-auto">
          <button
            onClick={() => setActiveStudioTab('single_image')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeStudioTab === 'single_image'
                ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                : 'text-fb-text-muted hover:text-fb-text'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">image</span>
            Tạo 1 Ảnh Teaser (Photo Post)
          </button>
          <button
            onClick={() => setActiveStudioTab('video_reel')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeStudioTab === 'video_reel'
                ? 'bg-fb-blue text-white shadow-md shadow-blue-500/20'
                : 'text-fb-text-muted hover:text-fb-text'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">movie</span>
            Tạo Video Story (10s - 30s)
          </button>
        </div>
      </div>

      {/** ======================================================== */}
      {/** MODE 1: SINGLE STORY IMAGE TEASER (PHOTO POST)          */}
      {/** ======================================================== */}
      {activeStudioTab === 'single_image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/** Left Column: Input Story & Settings */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-5">
              <div>
                <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-fb-blue flex items-center justify-center font-black text-sm">
                    1
                  </span>
                  Nhập Link Nguồn Hoặc Dán Câu Chuyện
                </h3>
                <p className="text-xs text-fb-text-muted mt-1">
                  Nhập link bài viết để tự động cào nội dung, hoặc dán trực tiếp câu chuyện để AI phân tích cảnh cao trào.
                </p>
              </div>

              {/** Source URL Input & Fetch */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-fb-text flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-cyan-400">link</span>
                    Nhập Link Nguồn Bài Viết:
                  </span>
                  {fetchedArticleTitle && (
                    <span className="text-[11px] text-emerald-400 font-bold truncate max-w-[220px]">
                      <span className="material-symbols-outlined text-[16px] text-emerald-400 align-middle mr-1">check</span>{fetchedArticleTitle}
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-fb-text-muted">
                      public
                    </span>
                    <input
                      type="url"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          ztteam_handleFetchFromUrl();
                        }
                      }}
                      placeholder="Dán link bài viết (Reddit, tin tức, blog truyện...)"
                      className="w-full pl-9 pr-3 py-2.5 bg-fb-surface-hover rounded-xl text-xs text-fb-text placeholder:text-fb-text-muted border border-fb-surface-hover focus:border-fb-blue focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={ztteam_handleFetchFromUrl}
                    disabled={isFetchingUrl || !sourceUrl.trim()}
                    className="px-4 py-2.5 bg-fb-surface-hover hover:bg-fb-blue hover:text-white text-fb-text text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    {isFetchingUrl ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                        <span>Đang Cào...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>Lấy Nội Dung</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-fb-text-muted flex items-center gap-1.5 pt-0.5">
                  <span className="material-symbols-outlined text-[14px] text-emerald-400 shrink-0">verified_user</span>
                  <span>Tự động kích hoạt Proxy Gateway Quốc Tế nếu trang web chặn IP Việt Nam hoặc bảo vệ bởi Cloudflare.</span>
                </p>
              </div>

              {/** Story Content Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-fb-text flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-blue-400">subject</span>
                    Văn bản câu chuyện (Dài):
                  </label>
                  <span className="text-[11px] font-mono text-fb-text-muted">
                    {content.length} ký tự
                  </span>
                </div>
                <textarea
                  rows={7}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Dán nội dung câu chuyện tại đây, hoặc nhập link phía trên và bấm 'Lấy Nội Dung'..."
                  className="w-full p-3.5 bg-fb-surface-hover rounded-xl text-xs text-fb-text placeholder:text-fb-text-muted border border-fb-surface-hover focus:border-fb-blue focus:outline-none transition-all font-mono leading-relaxed"
                />
              </div>

              {/** Settings: Aspect Ratio & Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-fb-surface-hover/80">
                <div>
                  <label className="block text-xs font-bold text-fb-text mb-2">
                    Tỷ Lệ Ảnh (Kích Thước):
                  </label>
                  <CustomDropdown
                    value={imageAspectRatio}
                    onChange={(val) => setImageAspectRatio(val as any)}
                    options={[
                      { value: '4:5', label: '4:5 (1080x1350 - Chuẩn FB Mobile)' },
                      { value: '1:1', label: '1:1 (1080x1080 - Vuông Feed)' },
                      { value: '16:9', label: '16:9 (1280x720 - Khung Ngang)' },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-fb-text mb-2">
                    Phong Cách Thị Giác:
                  </label>
                  <CustomDropdown
                    value={imageStyle}
                    onChange={(val) => setImageStyle(val as any)}
                    options={[
                      { value: 'cinematic', label: 'Cinematic Kịch Tính (8K)' },
                      { value: 'mystery_horror', label: 'Ma Mị, Lạnh Lẽo, U Tối' },
                      { value: 'vintage_antique', label: 'Cổ Điển 1920s Vintage' },
                    ]}
                  />
                </div>
              </div>

              {/** Action Button */}
              <button
                onClick={ztteam_handleGenerateSingleImage}
                disabled={isGeneratingImage || (!content.trim() && !sourceUrl.trim())}
                className="w-full py-3 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
              >
                {isGeneratingImage ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                    AI Đang Phân Tích & Sinh Ảnh 2K (~20s)...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">draw</span>
                    AI Phân Tích & Tạo 1 Ảnh Teaser 2K
                  </>
                )}
              </button>
            </div>
          </div>

          {/** Right Column: Generated Image & Facebook Post Mockup */}
          <div className="lg:col-span-7 space-y-6">
            {!singleImagePrompt && !isGeneratingImage && (
              <div className="bg-fb-surface rounded-2xl p-12 text-center shadow-lg border border-dashed border-fb-surface-hover">
                <div className="w-16 h-16 rounded-2xl bg-fb-surface-hover/80 text-fb-blue flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl">image</span>
                </div>
                <h4 className="text-base font-bold text-fb-text">Chưa Có Ảnh Nào Được Tạo</h4>
                <p className="text-xs text-fb-text-muted mt-1 max-w-md mx-auto">
                  Hãy nhập link nguồn bài viết hoặc dán câu chuyện ở cột bên trái và bấm <strong>"AI Phân Tích & Tạo 1 Ảnh Teaser 2K"</strong>. AI sẽ trích xuất khoảnh khắc đắt giá nhất và vẽ ảnh 2K.
                </p>
              </div>
            )}

            {isGeneratingImage && (
              <div className="bg-fb-surface rounded-2xl p-12 text-center shadow-lg space-y-4">
                <span className="material-symbols-outlined animate-spin text-5xl text-fb-blue">
                  autorenew
                </span>
                <h4 className="text-base font-bold text-fb-text">
                  AI Đang Đọc Cốt Truyện & Sinh Ảnh 2K...
                </h4>
                <p className="text-xs text-fb-text-muted max-w-sm mx-auto">
                  Đang chọn cảnh cao trào kịch tính nhất và vẽ ảnh 2K... Quá trình mất khoảng 20-25 giây.
                </p>
              </div>
            )}

            {singleImagePrompt && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/** Image Preview Card */}
                <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-fb-text flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        Bức Ảnh Teaser Đơn Lẻ 2K
                      </h4>
                      <p className="text-xs text-fb-text-muted mt-0.5">
                        Tỷ lệ {singleImageResult?.aspect_ratio || imageAspectRatio} • Kích thước{' '}
                        {singleImageResult?.width || 1080}x{singleImageResult?.height || 1350} (2K Ultra Clear)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={ztteam_handleReRenderImage}
                        disabled={isReRenderingImage}
                        className="px-3.5 py-1.5 bg-fb-surface-hover hover:bg-fb-blue hover:text-white text-fb-text text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isReRenderingImage ? 'animate-spin' : ''}`}>
                          cached
                        </span>
                        <span>{isReRenderingImage ? 'Đang Đổi Góc...' : 'Đổi Góc Chụp / Tạo Lại 2K'}</span>
                      </button>

                      {singleImageResult && (
                        <a
                          href={singleImageResult.imageUrl}
                          download="story-teaser-image-2k.png"
                          className="px-3.5 py-1.5 bg-fb-blue hover:opacity-90 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          <span>Tải Ảnh 2K</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/** Error Banner If Generation Fails */}
                  {imageGenerationError && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 font-bold text-amber-400">
                        <span className="material-symbols-outlined text-[18px]">error</span>
                        <span>Không Thể Tạo Ảnh AI</span>
                      </div>
                      <p className="leading-relaxed text-fb-text">{imageGenerationError}</p>
                      <p className="text-[11px] text-fb-text-muted">
                        <span className="material-symbols-outlined text-[16px] text-amber-400 align-middle mr-1">lightbulb</span><strong>Gợi ý:</strong> Bạn có thể chỉnh sửa lại đoạn prompt tiếng Anh ở khung bên dưới (tránh các từ liên quan đến bạo lực, chấn thương y tế, mặt bầm sưng hoặc trẻ em) rồi bấm <strong>"Render Lại Theo Prompt Này"</strong>.
                      </p>
                    </div>
                  )}

                  {/** Image Display */}
                  <div className="relative w-full max-w-[420px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black border border-fb-surface-hover group">
                    {singleImageResult ? (
                      <img
                        src={singleImageResult.imageUrl}
                        alt="Story Teaser"
                        className="w-full h-auto object-cover"
                      />
                    ) : (
                      <div className="aspect-[4/5] flex flex-col items-center justify-center p-6 text-center text-fb-text-muted space-y-3">
                        {imageGenerationError ? (
                          <>
                            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center">
                              <span className="material-symbols-outlined text-2xl">warning</span>
                            </div>
                            <p className="text-xs font-bold text-fb-text">Tạo ảnh thất bại</p>
                            <p className="text-[11px] text-fb-text-muted max-w-xs">
                              Vui lòng chỉnh lại prompt bên dưới và bấm nút Render Lại.
                            </p>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined animate-spin text-4xl text-fb-blue">sync</span>
                            <span className="text-xs font-medium text-fb-text-muted">Đang sinh ảnh 2K AI...</span>
                          </>
                        )}
                      </div>
                    )}


                    {singleImageResult && (
                      <a
                        href={singleImageResult.imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute bottom-3 right-3 bg-black/70 hover:bg-black text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">fullscreen</span>
                        Xem Ảnh Gốc
                      </a>
                    )}
                  </div>

                  {/** AI Scene Description in Vietnamese */}
                  <div className="p-3.5 bg-fb-surface-hover/70 rounded-xl border border-fb-surface-hover">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                      Bối Cảnh Được AI Lựa Chọn (Tiếng Việt):
                    </span>
                    <p className="text-xs text-fb-text font-medium leading-relaxed">
                      {singleImagePrompt.scene_desc_vi}
                    </p>
                  </div>

                  {/** Editable Image Prompt Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-fb-text-muted">
                        Prompt Tiếng Anh Tạo Ảnh (Có thể chỉnh sửa & render lại):
                      </label>
                      <button
                        onClick={ztteam_handleReRenderImage}
                        disabled={isReRenderingImage}
                        className="text-[11px] text-cyan-400 hover:underline font-bold flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        Render Lại Theo Prompt Này
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={editableImagePrompt}
                      onChange={(e) => setEditableImagePrompt(e.target.value)}
                      className="w-full p-3 bg-fb-surface-hover rounded-xl text-xs text-fb-text border border-fb-surface-hover focus:border-fb-blue focus:outline-none transition-all font-mono leading-relaxed"
                    />
                  </div>
                </div>

                {/** Motion Reel 9:16 Video Generator from 2K Image */}
                {singleImageResult && (
                  <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4 border border-blue-500/20">
                    <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-fb-text flex items-center gap-2">
                          <span className="material-symbols-outlined text-fb-blue text-[20px]">movie</span>
                          Tạo Video Reel Động (9:16) Từ Ảnh 2K Này
                        </h4>
                        <p className="text-xs text-fb-text-muted mt-0.5">
                          Hiệu ứng Ken Burns đẩy camera mượt mà (sub-pixel bicubic, 0 giật) + Phụ đề tiếng Anh + BGM fade-out
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                        0đ Chi phí
                      </span>
                    </div>

                    {/** Controls Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/** Duration Selector */}
                      <div>
                        <label className="text-[11px] font-bold text-fb-text-muted block mb-1">
                          Thời lượng Reel:
                        </label>
                        <div className="grid grid-cols-4 gap-1 bg-fb-surface-hover p-1 rounded-xl">
                          {[10, 15, 20, 30].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setMotionDuration(d)}
                              className={`py-1 rounded-lg text-xs font-bold transition-all ${
                                motionDuration === d
                                  ? 'bg-fb-blue text-white shadow-sm'
                                  : 'text-fb-text-muted hover:text-fb-text'
                              }`}
                            >
                              {d}s
                            </button>
                          ))}
                        </div>
                      </div>

                      {/** Motion Style */}
                      <div>
                        <label className="text-[11px] font-bold text-fb-text-muted block mb-1">
                          Hiệu ứng Camera:
                        </label>
                        <select
                          value={motionStyle}
                          onChange={(e) => setMotionStyle(e.target.value as any)}
                          className="w-full py-1.5 px-2 bg-fb-surface-hover rounded-xl text-xs text-fb-text border border-fb-surface-hover focus:border-fb-blue focus:outline-none transition-all font-medium"
                        >
                          <option value="ambient_zoom">Nền Mờ + Zoom Cận Cảnh (Chuẩn)</option>
                          <option value="cinematic_zoom">Cinematic Full Zoom 9:16</option>
                        </select>
                      </div>

                      {/** BGM Track */}
                      <div>
                        <label className="text-[11px] font-bold text-fb-text-muted block mb-1">
                          Nhạc nền (BGM):
                        </label>
                        <select
                          value={motionBgm}
                          onChange={(e) => setMotionBgm(e.target.value)}
                          className="w-full py-1.5 px-2 bg-fb-surface-hover rounded-xl text-xs text-fb-text border border-fb-surface-hover focus:border-fb-blue focus:outline-none transition-all font-medium"
                        >
                          {bgmList.length > 0 ? (
                            bgmList.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="suspense_dramatic.mp3">Suspense Dramatic</option>
                              <option value="mystery_deep.mp3">Mystery Deep</option>
                              <option value="emotional_story.mp3">Emotional Story</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>

                    {/** Render Action Button */}
                    <button
                      onClick={ztteam_handleRenderMotionReel}
                      disabled={isRenderingMotionReel}
                      className="w-full py-2.5 bg-gradient-to-r from-fb-blue via-cyan-500 to-emerald-500 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                    >
                      {isRenderingMotionReel ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[18px]">sync</span>
                          Đang Render Video Motion Reel ({motionDuration}s) mượt mà (~12s)...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">play_circle</span>
                          Render Video Reel Động 9:16 ({motionDuration}s) Từ Ảnh Này
                        </>
                      )}
                    </button>

                    {/** Rendered Video Result */}
                    {motionVideoResult && (
                      <div className="pt-3 border-t border-fb-surface-hover space-y-3 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            Video Reel Đã Render Hoàn Tất (Không Rung Giật)!
                          </span>
                          <span className="text-[11px] text-fb-text-muted font-mono">
                            1080x1920 • {motionVideoResult.duration}s
                          </span>
                        </div>

                        <div className="relative aspect-[9/16] w-full max-w-[260px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black border border-fb-surface-hover">
                          <video
                            src={motionVideoResult.videoUrl}
                            controls
                            autoPlay
                            loop
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="flex gap-2">
                          <a
                            href={motionVideoResult.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-fb-surface-hover text-fb-text hover:bg-fb-blue hover:text-white transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                            Mở Tab Mới
                          </a>
                          <a
                            href={motionVideoResult.videoUrl}
                            download="story-motion-reel.mp4"
                            className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-fb-blue text-white hover:opacity-90 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            Tải Video MP4
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/** Facebook Feed Post Preview Mockup */}
                <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-2">
                    <span className="text-xs font-bold text-fb-text flex items-center gap-2">
                      <span className="material-symbols-outlined text-blue-400 text-[18px]">visibility</span>
                      Mô Phỏng Bài Đăng Facebook Thực Tế
                    </span>
                    <button
                      onClick={() =>
                        ztteam_copyToClipboard(
                          `${singleImagePrompt.caption_en}\n\n${singleImagePrompt.first_comment}`,
                          'Caption & Link Bình Luận',
                        )
                      }
                      className="text-xs text-fb-blue hover:underline font-bold flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[15px]">content_copy</span>
                      Sao Chép Caption
                    </button>
                  </div>

                  {/** FB Post Box */}
                  <div className="bg-fb-surface-hover/50 rounded-2xl p-4 border border-fb-surface-hover space-y-3">
                    {/** Page Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-fb-blue to-cyan-500 text-white font-black flex items-center justify-center text-sm shadow-md">
                        SV
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-fb-text">Story Vault</span>
                          <span className="material-symbols-outlined text-[14px] text-blue-400">
                            verified
                          </span>
                        </div>
                        <span className="text-[11px] text-fb-text-muted flex items-center gap-1">
                          Vừa xong • <span className="material-symbols-outlined text-[11px]">public</span>
                        </span>
                      </div>
                    </div>

                    {/** Caption */}
                    <p className="text-xs text-fb-text whitespace-pre-line leading-relaxed font-sans">
                      {singleImagePrompt.caption_en}
                    </p>

                    {/** Embedded Image */}
                    {singleImageResult && (
                      <div className="rounded-xl overflow-hidden shadow-md max-h-[380px] bg-black flex items-center justify-center">
                        <img
                          src={singleImageResult.imageUrl}
                          alt="Facebook Post Preview"
                          className="w-full h-auto object-cover"
                        />
                      </div>
                    )}

                    {/** Pinned First Comment Mockup */}
                    <div className="p-3 bg-fb-surface rounded-xl border border-fb-blue/30 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-fb-blue"></span>
                        <span className="text-[11px] font-bold text-fb-blue">
                          Bình luận được ghim bởi Tác giả (Pinned Comment):
                        </span>
                      </div>
                      <p className="text-xs text-fb-text font-mono pl-3.5 text-cyan-300">
                        {singleImagePrompt.first_comment}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/** ======================================================== */}
      {/** MODE 2: STORY VIDEO REEL (10s - 30s)                    */}
      {/** ======================================================== */}
      {activeStudioTab === 'video_reel' && (
        <div className="space-y-6">
          {/** Step 1: Input Story & Settings */}
          <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-3">
              <div>
                <h3 className="text-base font-bold text-fb-text flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-blue-500/10 text-fb-blue flex items-center justify-center font-black text-xs">
                    1
                  </span>
                  Cấu Hình Video & Nhạc Nền
                </h3>
                <p className="text-xs text-fb-text-muted mt-0.5">
                  Xuất video ngắn 9:16 kèm phụ đề chữ to căn giữa và nhạc nền BGM tự động fade-out
                </p>
              </div>

              <button
                onClick={ztteam_handleGenerateScript}
                disabled={isGeneratingScript || !content.trim()}
                className="px-5 py-2 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-90 text-white font-bold rounded-full shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs whitespace-nowrap"
              >
                {isGeneratingScript ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[16px]">sync</span>
                    Đang Phân Tích...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">auto_fix_high</span>
                    Tạo Kịch Bản Thử Nghiệm
                  </>
                )}
              </button>
            </div>

            {/** Controls row: Duration & BGM */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-fb-text mb-2">
                  Thời lượng Video Teaser:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 20, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setDuration(sec)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                        duration === sec
                          ? 'bg-fb-blue text-white border-fb-blue shadow-md shadow-blue-500/20'
                          : 'bg-fb-surface-hover/70 text-fb-text-muted border-transparent hover:text-fb-text'
                      }`}
                    >
                      {sec} Giây
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text mb-2">
                  Nhạc nền BGM (Không lời, kịch tính):
                </label>
                <CustomDropdown
                  value={bgmTrack}
                  onChange={(val) => setBgmTrack(val)}
                  options={bgmList.map((bgm) => ({
                    value: bgm.id,
                    label: bgm.name,
                  }))}
                />
              </div>
            </div>
          </div>

          {/** Step 2 & 3: Script Review & Video Player */}
          {scriptData && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/** Left: Bilingual Script Review */}
              <div className="lg:col-span-8 space-y-6">
                <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-5">
                  <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-3">
                    <div>
                      <h4 className="text-base font-bold text-fb-text flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-blue-500/10 text-fb-blue flex items-center justify-center font-black text-xs">
                          2
                        </span>
                        Duyệt Kịch Bản Song Ngữ ({duration} Giây)
                      </h4>
                      <p className="text-xs text-fb-text-muted mt-0.5">
                        Bản dịch Tiếng Việt giúp bạn xem xét trước — Bản Tiếng Anh hiển thị trực tiếp trên video
                      </p>
                    </div>

                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold">
                      {scriptData.segments_en.length} Phân Đoạn
                    </span>
                  </div>

                  {/** Vietnamese Review Box */}
                  <div className="p-4 bg-gradient-to-r from-blue-950/20 to-fb-surface-hover/60 rounded-2xl border border-fb-surface-hover space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-cyan-400 text-[18px]">verified</span>
                      <h5 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Tóm Tắt Duyệt Cốt Truyện (Tiếng Việt)
                      </h5>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold text-fb-text">
                        Tiêu đề: {scriptData.preview_vi.tieu_de}
                      </p>
                      <p className="text-xs text-fb-text-muted leading-relaxed">
                        {scriptData.preview_vi.tom_tat}
                      </p>
                    </div>
                  </div>

                  {/** English On-Screen Segments Editor */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-fb-text">
                      Các câu chữ Tiếng Anh hiển thị trên màn hình (Có thể sửa trực tiếp):
                    </label>

                    <div className="space-y-3">
                      {scriptData.segments_en.map((seg, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 bg-fb-surface-hover rounded-xl border border-fb-surface-hover space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-fb-blue font-bold">
                              Phân đoạn #{idx + 1} ({seg.start}s - {seg.end}s)
                            </span>
                            <span className="text-fb-text-muted">
                              Thời lượng: {seg.end - seg.start} giây
                            </span>
                          </div>

                          <input
                            type="text"
                            value={seg.text}
                            onChange={(e) => ztteam_handleUpdateSegmentText(idx, e.target.value)}
                            className="w-full p-2.5 bg-fb-surface text-fb-text rounded-lg text-xs font-bold border border-fb-surface-hover focus:border-fb-blue focus:outline-none"
                          />

                          {scriptData.preview_vi.segments_dich[idx] && (
                            <p className="text-[11px] text-fb-text-muted italic pl-1">
                              ↳ Nghĩa dịch: {scriptData.preview_vi.segments_dich[idx].text}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/** Right: Video Render & Preview */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-fb-surface rounded-2xl p-5 shadow-lg space-y-4">
                  <div>
                    <h4 className="text-base font-bold text-fb-text flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-blue-500/10 text-fb-blue flex items-center justify-center font-black text-xs">
                        3
                      </span>
                      Xuất Video Thử Nghiệm
                    </h4>
                    <p className="text-xs text-fb-text-muted mt-0.5">
                      Tự động ghép ảnh + phụ đề viền đen + BGM fade-out
                    </p>
                  </div>

                  <button
                    onClick={ztteam_handleRenderVideo}
                    disabled={isRenderingVideo}
                    className="w-full py-3 bg-gradient-to-r from-fb-blue to-cyan-500 hover:opacity-95 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                  >
                    {isRenderingVideo ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                        Đang Render Video ({duration}s)...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[20px]">play_circle</span>
                        Render Video Teaser ({duration}s)
                      </>
                    )}
                  </button>
                </div>

                {/** Video Player Container */}
                {renderResult && (
                  <div className="bg-fb-surface rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-fb-surface-hover/80 pb-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Video Đã Render Xong!
                      </div>
                      <span className="text-[11px] font-mono text-fb-text-muted">
                        1080x1920 • {renderResult.duration}s
                      </span>
                    </div>

                    <div className="relative aspect-[9/16] w-full max-w-[280px] mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black border border-fb-surface-hover">
                      <video
                        src={renderResult.videoUrl}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex gap-2">
                      <a
                        href={renderResult.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-fb-surface-hover text-fb-text hover:bg-fb-blue hover:text-white transition-all flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        Mở Tab Mới
                      </a>
                      <a
                        href={renderResult.videoUrl}
                        download="story-teaser.mp4"
                        className="flex-1 py-2 rounded-xl text-xs font-bold text-center bg-fb-blue text-white hover:opacity-90 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        Tải Video Về
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
