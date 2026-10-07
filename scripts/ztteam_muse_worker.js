/**
 * ZTTeam: Dịch vụ nền tự động hóa Muse.ai (Local Worker)
 * Chạy trên máy tính Windows, kết nối Chrome port 9222 và giao tiếp với VPS API
 * Tác giả: ZTTeam (ztteam.site)
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/** Cấu hình kết nối */
const VPS_BASE_URL = process.env.VPS_API_URL || 'http://169.58.122.248:3001';
const API_URL = `${VPS_BASE_URL}/api`;
const CHROME_DEBUG_URL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const POLL_INTERVAL_MS = 15000; /** 15 giây kiểm tra hàng đợi một lần */
const TEMP_DIR = path.resolve(__dirname, '../scratch/worker_temp');
const SUCCESS_COOLDOWN_SEC = 60; /** Nghỉ 60 giây sau khi tạo thành công 1 video */
const FAILURE_COOLDOWN_SEC = 30; /** Nghỉ 30 giây nếu bài gặp lỗi/từ chối */

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/** Biến trạng thái worker */
let isProcessing = false;

/** Hàm đếm ngược thời gian nghỉ an toàn */
async function ztteam_cooldown(seconds, reason) {
  console.log(`\n⏳ [Nghỉ an toàn] ${reason}.`);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r   ⏱️ Đang chờ ${i} giây trước khi tiếp tục...   `);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r                                                              \r');
}

/** Hàm tải file từ URL về máy tính */
async function ztteam_downloadFile(url, destPath) {
  const fullUrl = url.startsWith('http') ? url : `${VPS_BASE_URL}${url}`;
  const response = await axios({
    url: fullUrl,
    method: 'GET',
    responseType: 'stream',
    timeout: 30000,
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/** Hàm kiểm tra cổng Chrome debugging có đang mở không */
async function ztteam_isChromeRunning() {
  try {
    const res = await axios.get(`${CHROME_DEBUG_URL}/json/version`, { timeout: 2000 });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Hàm thực thi render 1 video trên Muse.ai */
async function ztteam_processVideoJobOnMuse(job) {
  console.log(`\n========================================================`);
  console.log(`🎬 BẮT ĐẦU XỬ LÝ JOB TẠO REEL: #${job.id}`);
  console.log(`📖 Tiêu đề: ${job.title}`);
  console.log(`========================================================`);

  const localImagePath = path.join(TEMP_DIR, `job_img_${job.id}.png`);
  const localVideoPath = path.join(TEMP_DIR, `job_vid_${job.id}.mp4`);

  try {
    /** 1. Tải ảnh 2K SangTao từ VPS về máy */
    console.log(`⬇️ [1/5] Đang tải ảnh từ VPS: ${job.imageUrl}`);
    await ztteam_downloadFile(job.imageUrl, localImagePath);
    console.log(`✅ Đã lưu ảnh tạm tại: ${localImagePath}`);

    /** 2. Kết nối Chrome */
    console.log(`🌐 [2/5] Đang kết nối tới Chrome (${CHROME_DEBUG_URL})...`);
    const browser = await puppeteer.connect({
      browserURL: CHROME_DEBUG_URL,
      defaultViewport: null,
    });

    let page;
    try {
      const pages = await browser.pages();
      page = pages.find(p => p.url().includes('muse.ai'));
      if (!page) {
        console.log('ℹ️ Mở tab Muse.ai mới...');
        page = await browser.newPage();
        await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded' });
      }
      await page.bringToFront();

      /** Ghi nhận danh sách các video stream và nút download hiện có trước khi gửi prompt */
      const initialVideoSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('video'))
          .filter(v => v.closest('.rounded-full') === null && (v.videoWidth !== 480 || v.videoHeight !== 480))
          .map(v => v.src)
          .filter(Boolean);
      });
      const initialDownloadBtnCount = await page.evaluate(() => {
        return document.querySelectorAll('button[aria-label="Tải video xuống"]').length;
      });
      const initialProseCount = await page.evaluate(() => {
        return document.querySelectorAll('.prose').length;
      });

      /** 3. Upload ảnh */
      console.log(`📤 [3/5] Đang đính kèm ảnh vào khung chat Muse.ai...`);
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) throw new Error('Không tìm thấy input[type="file"] trên Muse.ai');
      await fileInput.uploadFile(localImagePath);
      await new Promise(r => setTimeout(r, 3000));

      /** 4. Dán prompt (Copy & Paste an toàn không bị Enter gửi sớm) và bấm gửi */
      console.log(`✍️ [4/5] Đang dán toàn bộ câu lệnh & nội dung câu chuyện...`);
      const textarea = await page.$('textarea');
      if (!textarea) throw new Error('Không tìm thấy ô textarea để nhập prompt');
      await textarea.click();

      /** Sử dụng document.execCommand('insertText') để dán toàn bộ nội dung nguyên vẹn mà không bấm phím Enter */
      await page.evaluate((fullPrompt) => {
        const ta = document.querySelector('textarea');
        if (!ta) return;
        ta.focus();
        ta.select();
        document.execCommand('insertText', false, fullPrompt);
      }, job.prompt);
      await new Promise(r => setTimeout(r, 1200));

      console.log(`🚀 Đang bấm gửi tin nhắn...`);
      /** Bấm nút Gửi nếu có, hoặc nhấn Enter sau khi văn bản đã được dán hoàn tất */
      const sentViaButton = await page.evaluate(() => {
        const sendBtn = document.querySelector('button[aria-label="Gửi"], button[type="submit"]:not([aria-label="Đính kèm file"])');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          return true;
        }
        return false;
      });

      if (!sentViaButton) {
        await page.keyboard.press('Enter');
      }

      /** 5. Chờ Muse.ai render xong video 15s */
      const timeoutMs = 420000; /** 7 phút tối đa */
      console.log(`⏳ [5/5] Đang chờ Muse.ai render video (tối đa 7 phút)...`);
      const startTime = Date.now();
      let videoRendered = false;

      while (Date.now() - startTime < timeoutMs) {
        await new Promise(r => setTimeout(r, 4000));
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        const check = await page.evaluate((initialSrcs, initialBtnCount, initialProses) => {
          /** Kiểm tra nếu có phản hồi từ chối / lỗi từ bot Muse */
          const currentProses = Array.from(document.querySelectorAll('.prose'));
          const newProses = currentProses.slice(initialProses);
          let refusalError = null;
          const refusalKeywords = [
            'không tạo được video',
            'gửi ảnh khác nhé',
            'không thể tạo video',
            'vi phạm chính sách',
            'nội dung này không phù hợp',
            'thử lại với ảnh khác',
            'lỗi tạo video'
          ];
          for (const prose of newProses) {
            const txt = (prose.innerText || '').toLowerCase();
            const matched = refusalKeywords.find(kw => txt.includes(kw));
            if (matched) {
              refusalError = prose.innerText.trim();
              break;
            }
          }

          const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
            const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
            return !isAvatar;
          });

          const currentBtnCount = document.querySelectorAll('button[aria-label="Tải video xuống"]').length;
          const hasNewBtn = currentBtnCount > initialBtnCount;

          /** Kiểm tra xem có video mới có src khác với các video ban đầu */
          const newVideo = contentVideos.find(v => v.src && !initialSrcs.includes(v.src));
          const lastVideo = contentVideos[contentVideos.length - 1];

          /** Kiểm tra text thông báo hoàn tất từ trợ lý */
          const bodyText = document.body.innerText || '';
          const hasCompletionText = bodyText.includes('Xong video 15s') || bodyText.includes('Đã xuất video 15s');

          /** Điều kiện hoàn tất: Có nút tải mới, hoặc có video src mới, hoặc tin nhắn xong kèm video */
          const isReady = (hasNewBtn && lastVideo && lastVideo.src) ||
                          (newVideo && (newVideo.duration > 3 || newVideo.readyState >= 2 || newVideo.src.startsWith('blob:'))) ||
                          (hasCompletionText && lastVideo && lastVideo.src && !initialSrcs.includes(lastVideo.src));

          return {
            isReady: !!isReady,
            count: contentVideos.length,
            hasNewBtn,
            hasNewSrc: !!newVideo,
            refusalError,
          };
        }, initialVideoSrcs, initialDownloadBtnCount, initialProseCount);

        if (check.refusalError) {
          console.log(`\n❌ Muse.ai từ chối: "${check.refusalError}"`);
          throw new Error(`Muse.ai từ chối: ${check.refusalError}`);
        }

        process.stdout.write(`\r   ⏱️ Đang render: ${elapsedSec}s | Video count: ${check.count} | NewBtn: ${check.hasNewBtn ? 'CÓ' : 'Chưa'} | Ready: ${check.isReady ? 'CÓ' : 'Đang chờ...'}`);

        if (check.isReady) {
          console.log(`\n🎉 Muse.ai đã render xong video sau ${elapsedSec} giây!`);
          videoRendered = true;
          break;
        }
      }

      if (!videoRendered) {
        throw new Error('Quá thời gian chờ render (timeout 7 phút)');
      }

      /** Chờ 3s để stream hoàn tất */
      await new Promise(r => setTimeout(r, 3000));

      /** Trích xuất dữ liệu video blob */
      console.log(`💾 Đang trích xuất dữ liệu video MP4...`);
      const base64Data = await page.evaluate(async (initialSrcs) => {
        const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
          const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
          return !isAvatar && v.src;
        });
        if (contentVideos.length === 0) return null;

        /** Ưu tiên video có src mới, nếu không thì lấy video cuối cùng */
        const target = contentVideos.find(v => !initialSrcs.includes(v.src)) || contentVideos[contentVideos.length - 1];
        if (!target || !target.src) return null;

        const res = await fetch(target.src);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }, initialVideoSrcs);

      if (!base64Data || !base64Data.startsWith('data:')) {
        throw new Error('Không đọc được dữ liệu video stream từ Muse');
      }

      const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
      fs.writeFileSync(localVideoPath, buffer);
      console.log(`✅ Đã lưu file video tạm: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    } finally {
      browser.disconnect();
    }

    /** 6. Upload video MP4 lên VPS */
    console.log(`📤 Đang tải video lên VPS (${API_URL}/image/${job.id}/attach-video)...`);
    const formData = new FormData();
    formData.append('video', fs.createReadStream(localVideoPath), {
      filename: `muse_reel_${job.id}.mp4`,
      contentType: 'video/mp4',
    });

    const uploadRes = await axios.post(`${API_URL}/image/${job.id}/attach-video`, formData, {
      headers: {
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    console.log(`========================================================`);
    console.log(`🎉 HOÀN TẤT THÀNH CÔNG JOB #${job.id}!`);
    console.log(`📹 Video URL trên VPS: ${uploadRes.data.videoUrl}`);
    console.log(`========================================================\n`);

    /** Nghỉ an toàn sau khi tạo thành công */
    await ztteam_cooldown(SUCCESS_COOLDOWN_SEC, 'Đã tạo video thành công');
  } catch (err) {
    console.error(`\n❌ LỖI KHI XỬ LÝ JOB #${job.id}:`, err.message);

    /** Báo lỗi lên VPS để không bị kẹt trạng thái */
    try {
      await axios.post(`${API_URL}/image/${job.id}/fail-video`, { error: err.message });
      console.log(`⚠️ Đã cập nhật trạng thái FAILED lên VPS.`);
    } catch (apiErr) {
      console.error(`Không thể báo lỗi lên VPS:`, apiErr.message);
    }

    /** Nghỉ an toàn sau khi gặp lỗi */
    await ztteam_cooldown(FAILURE_COOLDOWN_SEC, 'Gặp lỗi trong quá trình tạo video');
  } finally {
    /** Dọn dẹp file tạm */
    if (fs.existsSync(localImagePath)) fs.unlinkSync(localImagePath);
    if (fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
  }
}

/** Vòng lặp chính thăm dò hàng đợi từ VPS */
async function ztteam_workerLoop() {
  if (isProcessing) return;

  try {
    /** 1. Kiểm tra Chrome có đang bật không */
    const chromeAlive = await ztteam_isChromeRunning();
    if (!chromeAlive) {
      console.log(`[Chờ] Trình duyệt Chrome port 9222 chưa mở. Vui lòng chạy start_chrome_muse.bat!`);
      return;
    }

    /** 2. Hỏi VPS xem có job tạo video không (ưu tiên bài PENDING, sau đó tự động nạp các bài Reel/Mixed chưa có video) */
    const res = await axios.get(`${API_URL}/image/pending-video?auto=true`, { timeout: 10000 });
    if (res.data && res.data.hasJob && res.data.job) {
      isProcessing = true;
      await ztteam_processVideoJobOnMuse(res.data.job);
      isProcessing = false;
    } else {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Đang lắng nghe VPS... (Đã hoàn tất toàn bộ video cho Fanpage Reel/Mixed)`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n[Lỗi kết nối] Không thể kết nối tới VPS: ${VPS_BASE_URL}`);
    } else {
      console.error(`\n[Worker Error]:`, err.message);
    }
  }
}

console.log('========================================================');
console.log('🚀 ZTTEAM MUSE REEL WORKER ĐÃ KHỞI CHẠY!');
console.log(`🌐 VPS API Target: ${API_URL}`);
console.log(`🖥️ Chrome Target : ${CHROME_DEBUG_URL}`);
console.log(`⏱️ Chu kỳ kiểm tra: mỗi ${POLL_INTERVAL_MS / 1000}s`);
console.log('========================================================\n');

/** Chạy ngay lần đầu và đặt chu kỳ polling */
ztteam_workerLoop();
setInterval(ztteam_workerLoop, POLL_INTERVAL_MS);
