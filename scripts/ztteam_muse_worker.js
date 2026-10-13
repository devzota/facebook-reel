/**
 * ZTTeam: Dịch vụ nền tự động hóa Muse.ai (Local Worker)
 * Chạy trên máy tính Windows, kết nối Chrome port 9222
 * Hỗ trợ luân phiên cả 2 hệ thống: auto.ztteam.site (3000) & reel.didinao.com (3001)
 * Tác giả: ZTTeam (ztteam.site)
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

/** Danh sách các hệ thống VPS được phục vụ luân phiên */
const VPS_TARGETS = [
  { id: 'auto_ztteam', name: 'auto.ztteam.site', url: process.env.AUTO_ZTTEAM_URL || 'http://169.58.122.248:3000' },
  { id: 'didinao',     name: 'reel.didinao.com', url: process.env.DIDINAO_URL     || 'http://169.58.122.248:3001' },
];

let currentTargetIndex = 0;
const CHROME_DEBUG_URL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const POLL_INTERVAL_MS = 15000; /** 15 giây kiểm tra hàng đợi một lần */
const TEMP_DIR = path.resolve(__dirname, '../scratch/worker_temp');
const LOGS_DIR = path.resolve(__dirname, '../logs');
const LOG_FILE = path.join(LOGS_DIR, 'ztteam_muse_worker.log');
const SUCCESS_COOLDOWN_SEC = 60; /** Nghỉ 60 giây sau khi tạo thành công 1 video */
const FAILURE_COOLDOWN_SEC = 60; /** Nghỉ 60 giây nếu bài gặp lỗi để Muse ổn định */
const CDP_PROTOCOL_TIMEOUT_MS = 600000; /** 10 phút timeout cho Puppeteer CDP connection */

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/** Biến cờ ngăn chặn chạy song song nhiều job cùng lúc */
let isProcessing = false;

/** Hàm ghi nhật ký đồng thời ra console và file */
function ztteam_log(message) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
  const fullStamp = now.toISOString();
  console.log(`[${timeStr}] ${message}`);
  try {
    fs.appendFileSync(LOG_FILE, `[${fullStamp}] ${message}\n`, 'utf8');
  } catch (e) {}
}

/** Hàm đếm ngược thời gian nghỉ an toàn */
async function ztteam_cooldown(seconds, reason) {
  ztteam_log(`⏳ [Nghỉ an toàn] ${reason}.`);
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r   ⏱️ Đang chờ ${i} giây trước khi tiếp tục...   `);
    await new Promise(r => setTimeout(r, 1000));
  }
  process.stdout.write('\r                                                              \r');
}

/** Hàm tải file từ URL về máy tính */
async function ztteam_downloadFile(url, destPath, targetBaseUrl) {
  const fullUrl = url.startsWith('http') ? url : `${targetBaseUrl}${url}`;
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

/** Hàm dọn dẹp và reset giao diện Muse.ai về trạng thái trắng sạch */
async function ztteam_resetMusePage(page) {
  if (!page) return;
  try {
    ztteam_log('🧹 Đang làm mới tab Muse.ai để đảm bảo khung chat sạch 100%...');
    await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('textarea', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    ztteam_log(`⚠️ Không thể reload tab Muse: ${err.message}`);
  }
}

/** Hàm thực thi render 1 video trên Muse.ai */
async function ztteam_processVideoJobOnMuse(job, target) {
  ztteam_log(`========================================================`);
  ztteam_log(`🎬 BẮT ĐẦU XỬ LÝ JOB TẠO REEL: #${job.id}`);
  ztteam_log(`🌐 Hệ thống : ${target.name} (${target.url})`);
  ztteam_log(`📖 Tiêu đề  : ${job.title}`);
  ztteam_log(`========================================================`);

  const localImagePath = path.join(TEMP_DIR, `job_img_${job.id}.png`);
  const localVideoPath = path.join(TEMP_DIR, `job_vid_${job.id}.mp4`);
  let browser = null;

  try {
    let videoRendered = false;
    let base64Data = null;

    /** 1. Kết nối Chrome với protocolTimeout 10 phút (chống triệt để Runtime.callFunctionOn timed out) */
    ztteam_log(`🌐 [1/4] Đang kết nối tới Chrome (${CHROME_DEBUG_URL}) với timeout 10 phút...`);
    browser = await puppeteer.connect({
      browserURL: CHROME_DEBUG_URL,
      defaultViewport: null,
      protocolTimeout: CDP_PROTOCOL_TIMEOUT_MS,
    });

    const pages = await browser.pages();
    let page = pages.find(p => p.url().includes('muse.ai'));
    if (!page) {
      ztteam_log('ℹ️ Mở tab Muse.ai mới...');
      page = await browser.newPage();
      await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded' });
    }
    await page.bringToFront();

    /** Chờ khung nhập liệu sẵn sàng */
    await page.waitForSelector('textarea', { timeout: 20000 });
    await new Promise(r => setTimeout(r, 1500));

    /** 1.1 Kiểm tra xem khung chat có đang dính ảnh hoặc text cũ từ lần trước không */
    const isDirty = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      const hasText = ta && ta.value && ta.value.trim().length > 0;
      /** Tìm xem có thumbnail ảnh preview nào đang gắn trong composer không */
      const previewImgs = document.querySelectorAll('div[class*="preview"] img, div[class*="attachment"] img, form img');
      const removeBtns = document.querySelectorAll('button[aria-label*="xóa" i], button[aria-label*="remove" i], button[aria-label*="delete" i]');
      return hasText || previewImgs.length > 0 || removeBtns.length > 0;
    });

    if (isDirty) {
      ztteam_log('⚠️ Phát hiện ảnh hoặc nội dung kẹt lại trong khung chat. Đang làm mới tab...');
      await ztteam_resetMusePage(page);
    }

    /** 1.2 Tải ảnh hiện tại của job từ VPS về máy tính */
    if (fs.existsSync(localImagePath)) {
      try { fs.unlinkSync(localImagePath); } catch (e) {}
    }
    ztteam_log(`⬇️ Đang tải ảnh từ ${target.name}: ${job.imageUrl}`);
    await ztteam_downloadFile(job.imageUrl, localImagePath, target.url);
    ztteam_log(`✅ Đã lưu ảnh tạm tại: ${localImagePath}`);

    /** Ghi nhận danh sách các video stream, nút download và số lượng tin nhắn hiện có trước khi gửi prompt */
    const initialStats = await page.evaluate(() => {
      const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
        const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
        return !isAvatar;
      });
      const downloadBtns = document.querySelectorAll('button[aria-label="Tải video xuống"]').length;
      const srcs = contentVideos.map(v => v.src).filter(Boolean);
      const proseCount = document.querySelectorAll('.prose, [data-message-author-role="assistant"]').length;
      return {
        count: contentVideos.length,
        downloadBtns,
        srcs,
        proseCount,
      };
    });

    ztteam_log(`🔍 Trạng thái ban đầu trên Muse: ${initialStats.count} video | ${initialStats.downloadBtns} nút tải | ${initialStats.proseCount} tin nhắn trợ lý`);

    /** 2. Upload ảnh đính kèm */
    ztteam_log(`📤 Đang đính kèm ảnh vào khung chat Muse.ai...`);
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error('Không tìm thấy input[type="file"] trên Muse.ai');
    await fileInput.uploadFile(localImagePath);
    await new Promise(r => setTimeout(r, 3500));

    /** 3. Dán prompt duy nhất 1 lần vào textarea */
    ztteam_log(`✍️ Đang dán câu lệnh & nội dung câu chuyện...`);
    const textarea = await page.$('textarea');
    if (!textarea) throw new Error('Không tìm thấy ô textarea để nhập prompt');
    await textarea.click();

    /** Dán toàn bộ nội dung nguyên vẹn vào textarea và kích hoạt event input */
    await page.evaluate((fullPrompt) => {
      const ta = document.querySelector('textarea');
      if (!ta) return;
      ta.focus();
      ta.value = '';
      document.execCommand('insertText', false, fullPrompt);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
    }, job.prompt);
    await new Promise(r => setTimeout(r, 1500));

    /** 3.1 Bấm gửi tin nhắn và XÁC NHẬN TIN NHẮN ĐÃ GỬI THÀNH CÔNG */
    ztteam_log(`🚀 Đang chờ nút Gửi sẵn sàng và bấm gửi tin nhắn...`);
    let messageSent = false;
    const sendWaitStart = Date.now();

    while (Date.now() - sendWaitStart < 25000) {
      const sendResult = await page.evaluate(() => {
        const sendBtn = document.querySelector('button[aria-label="Gửi"], button[type="submit"]:not([aria-label="Đính kèm file"])');
        if (sendBtn && !sendBtn.disabled) {
          sendBtn.click();
          return { clicked: true, disabled: false };
        }
        return { clicked: false, disabled: sendBtn ? sendBtn.disabled : true };
      });

      if (sendResult.clicked) {
        await new Promise(r => setTimeout(r, 1500));
        const isCleared = await page.evaluate(() => {
          const ta = document.querySelector('textarea');
          return !ta || ta.value.trim().length === 0;
        });
        if (isCleared) {
          messageSent = true;
          break;
        }
      }

      /** Thử phím Enter */
      await page.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1200));

      const checkAfterEnter = await page.evaluate(() => {
        const ta = document.querySelector('textarea');
        return !ta || ta.value.trim().length === 0;
      });
      if (checkAfterEnter) {
        messageSent = true;
        break;
      }

      await new Promise(r => setTimeout(r, 1500));
    }

    if (!messageSent) {
      throw new Error('Không thể gửi tin nhắn lên Muse.ai (Nút Gửi bị vô hiệu hóa hoặc ảnh chưa hoàn tất tải lên)');
    }
    ztteam_log(`✅ Đã gửi thành công tin nhắn và ảnh lên Muse.ai!`);

    /** 4. Chờ Muse.ai render xong video 15s */
    const timeoutMs = 420000; /** 7 phút tối đa */
    ztteam_log(`⏳ [2/4] Đang chờ Muse.ai render video mới (tối đa 7 phút)...`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      await new Promise(r => setTimeout(r, 4000));
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);

      const check = await page.evaluate((initialData) => {
        /** Chỉ kiểm tra các tin nhắn trợ lý MỚI xuất hiện sau khi gửi prompt */
        const refusalKeywords = [
          'không tạo được video',
          'gửi ảnh khác nhé',
          'không thể tạo video',
          'vi phạm chính sách',
          'nội dung này không phù hợp',
          'thử lại với ảnh khác',
          'lỗi tạo video',
          'chính sách an toàn',
          'không thể hỗ trợ'
        ];
        const allProses = Array.from(document.querySelectorAll('.prose, [data-message-author-role="assistant"]'));
        const newProses = allProses.slice(initialData.proseCount);
        let refusalError = null;
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
        const hasNewBtn = currentBtnCount > initialData.downloadBtns;

        /** Video mới xuất hiện (có src mới hoặc số lượng video tăng) */
        const newVideo = contentVideos.find(v => v.src && !initialData.srcs.includes(v.src));
        const lastVideo = contentVideos[contentVideos.length - 1];

        /** BẮT BUỘC: Video thực sự xong khi có nút tải mới HOẶC thời lượng video đạt chuẩn (>= 10s) */
        const isVideoFinished = (newVideo && newVideo.duration >= 10 && !newVideo.seeking) ||
                                (lastVideo && contentVideos.length > initialData.count && lastVideo.duration >= 10 && !lastVideo.seeking);

        const isReady = hasNewBtn || isVideoFinished;

        return {
          isReady: !!isReady,
          count: contentVideos.length,
          hasNewBtn,
          hasNewVideo: !!newVideo,
          videoDuration: lastVideo ? lastVideo.duration : 0,
          refusalError,
        };
      }, initialStats);

      if (check.refusalError) {
        ztteam_log(`\n❌ Muse.ai từ chối: "${check.refusalError}"`);
        throw new Error(`Muse.ai từ chối: ${check.refusalError}`);
      }

      process.stdout.write(`\r   ⏱️ Đang render: ${elapsedSec}s | Video: ${check.count} | Nút tải: ${check.hasNewBtn ? 'CÓ' : 'Chưa'} | Thời lượng: ${check.videoDuration ? check.videoDuration.toFixed(1) + 's' : '0s'} | Trạng thái: ${check.isReady ? 'HOÀN TẤT' : 'Đang chờ...'}`);

      if (check.isReady) {
        ztteam_log(`\n🎉 Muse.ai đã render xong video mới sau ${elapsedSec} giây!`);
        videoRendered = true;
        break;
      }
    }

    if (!videoRendered) {
      throw new Error('Quá thời gian chờ render trên Muse.ai (timeout 7 phút)');
    }

    /** Chờ 3s để stream buffer ổn định */
    await new Promise(r => setTimeout(r, 3000));

    /** 5. Trích xuất dữ liệu video blob mới */
    ztteam_log(`💾 [3/4] Đang trích xuất dữ liệu video MP4 mới...`);
    base64Data = await page.evaluate(async (initialSrcs) => {
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
    }, initialStats.srcs);

    if (!base64Data || !base64Data.startsWith('data:')) {
      throw new Error('Không đọc được dữ liệu video stream mới từ Muse.ai');
    }

    const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
    if (buffer.length < 200 * 1024) {
      throw new Error(`File video tải về quá nhỏ (${(buffer.length / 1024).toFixed(1)} KB), chưa hoàn chỉnh.`);
    }

    fs.writeFileSync(localVideoPath, buffer);
    ztteam_log(`✅ Đã lưu file video MP4 hoàn chỉnh: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    /** 6. Upload video MP4 lên đúng hệ thống VPS */
    ztteam_log(`📤 [4/4] Đang tải video lên ${target.name} (${target.url}/api/image/${job.id}/attach-video)...`);
    const formData = new FormData();
    formData.append('video', fs.createReadStream(localVideoPath), {
      filename: `muse_reel_${job.id}.mp4`,
      contentType: 'video/mp4',
    });

    const uploadRes = await axios.post(`${target.url}/api/image/${job.id}/attach-video`, formData, {
      headers: { ...formData.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    ztteam_log(`========================================================`);
    ztteam_log(`🎉 HOÀN TẤT THÀNH CÔNG JOB #${job.id} CHO [${target.name}]!`);
    ztteam_log(`📹 Video URL trên hệ thống: ${uploadRes.data.videoUrl}`);
    ztteam_log(`========================================================\n`);

    /** Nghỉ an toàn đúng 60 giây (1 phút) trước khi cho phép tạo bài tiếp theo */
    await ztteam_cooldown(SUCCESS_COOLDOWN_SEC, 'Đã hoàn tất và tải video lên VPS. Dừng nghỉ 1 phút trước khi tạo bài mới');
  } catch (err) {
    ztteam_log(`\n❌ LỖI KHI XỬ LÝ JOB #${job.id}: ${err.message}`);

    /** Báo lỗi lên đúng hệ thống VPS */
    try {
      await axios.post(`${target.url}/api/image/${job.id}/fail-video`, { error: err.message });
      ztteam_log(`⚠️ Đã cập nhật trạng thái FAILED lên [${target.name}].`);
    } catch (apiErr) {
      ztteam_log(`Không thể báo lỗi lên VPS: ${apiErr.message}`);
    }

    /** TỰ ĐỘNG DỌN DẸP KHUNG CHAT: Làm mới tab Muse.ai ngay lập tức để không lưu rác/ảnh kẹt cho Job tiếp theo */
    if (browser) {
      try {
        const pages = await browser.pages();
        const page = pages.find(p => p.url().includes('muse.ai'));
        if (page) {
          await ztteam_resetMusePage(page);
        }
      } catch (cleanErr) {
        ztteam_log(`Lỗi khi dọn dẹp tab Muse: ${cleanErr.message}`);
      }
    }

    /** Nghỉ an toàn 60 giây sau khi gặp lỗi để tab Muse ổn định */
    await ztteam_cooldown(FAILURE_COOLDOWN_SEC, 'Gặp lỗi trong quá trình tạo video. Dừng nghỉ 1 phút trước khi thử lại');
  } finally {
    if (browser) {
      try { browser.disconnect(); } catch (e) {}
    }
    /** Dọn dẹp file tạm trên máy */
    if (fs.existsSync(localImagePath)) {
      try { fs.unlinkSync(localImagePath); } catch (e) {}
    }
    if (fs.existsSync(localVideoPath)) {
      try { fs.unlinkSync(localVideoPath); } catch (e) {}
    }
  }
}

/** Vòng lặp chính luân phiên thăm dò hàng đợi từ cả 2 hệ thống */
async function ztteam_workerLoop() {
  if (isProcessing) return;

  try {
    /** 1. Kiểm tra Chrome có đang bật không */
    const chromeAlive = await ztteam_isChromeRunning();
    if (!chromeAlive) {
      process.stdout.write(`\r[Chờ] Trình duyệt Chrome port 9222 chưa mở. Vui lòng chạy start_chrome_muse.bat!`);
      return;
    }

    /** 2. Lấy hệ thống kiểm tra theo vòng lặp Round-Robin */
    const target = VPS_TARGETS[currentTargetIndex];
    currentTargetIndex = (currentTargetIndex + 1) % VPS_TARGETS.length;

    /** 3. Hỏi hệ thống xem có job tạo video không */
    const res = await axios.get(`${target.url}/api/image/pending-video?auto=true`, { timeout: 10000 });
    if (res.data && res.data.hasJob && res.data.job) {
      isProcessing = true;
      ztteam_log(`\n🎯 Phát hiện bài viết cần tạo Video từ [${target.name}]: Job #${res.data.job.id}`);
      try {
        await ztteam_processVideoJobOnMuse(res.data.job, target);
      } finally {
        isProcessing = false;
      }
    } else {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Đang kiểm tra [${target.name}]... (Hàng đợi trống)`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      process.stdout.write(`\r⚠️ Không kết nối được tới hệ thống... Đang thử lại`);
    } else {
      ztteam_log(`[Worker Error]: ${err.message}`);
    }
  }
}

console.log('========================================================');
console.log('🚀 ZTTEAM MUSE REEL WORKER ĐA HỆ THỐNG ĐÃ KHỞI CHẠY!');
console.log('📋 Danh sách hệ thống phục vụ luân phiên:');
VPS_TARGETS.forEach(t => console.log(`   - ${t.name}: ${t.url}`));
console.log(`🖥️ Chrome Target : ${CHROME_DEBUG_URL}`);
console.log(`⏱️ Chu kỳ kiểm tra: mỗi ${POLL_INTERVAL_MS / 1000}s`);
console.log(`⏱️ Protocol Timeout: ${CDP_PROTOCOL_TIMEOUT_MS / 60000} phút`);
console.log(`📁 File nhật ký   : ${LOG_FILE}`);
console.log('🛡️ Cơ chế: Chống dồn ảnh 100%, tự động làm sạch khung chat!');
console.log('========================================================\n');

/** Chạy ngay lần đầu và duy trì chu kỳ polling */
ztteam_workerLoop();
setInterval(ztteam_workerLoop, POLL_INTERVAL_MS);
