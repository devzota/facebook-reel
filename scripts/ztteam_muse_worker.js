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
const SUCCESS_COOLDOWN_SEC = 60; /** Nghỉ 60 giây sau khi tạo thành công 1 video */
const FAILURE_COOLDOWN_SEC = 30; /** Nghỉ 30 giây nếu bài gặp lỗi */

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/** Biến cờ ngăn chặn chạy song song nhiều job cùng lúc */
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

/** Hàm thực thi render 1 video trên Muse.ai */
async function ztteam_processVideoJobOnMuse(job, target) {
  console.log(`\n========================================================`);
  console.log(`🎬 BẮT ĐẦU XỬ LÝ JOB TẠO REEL: #${job.id}`);
  console.log(`🌐 Hệ thống : ${target.name} (${target.url})`);
  console.log(`📖 Tiêu đề  : ${job.title}`);
  console.log(`========================================================`);

  const localImagePath = path.join(TEMP_DIR, `job_img_${job.id}.png`);
  const localVideoPath = path.join(TEMP_DIR, `job_vid_${job.id}.mp4`);

  try {
    let videoRendered = false;
    let base64Data = null;

    /** 1. Kết nối Chrome */
    console.log(`🌐 [1/4] Đang kết nối tới Chrome (${CHROME_DEBUG_URL})...`);
    const browser = await puppeteer.connect({
      browserURL: CHROME_DEBUG_URL,
      defaultViewport: null,
    });

    try {
      const pages = await browser.pages();
      let page = pages.find(p => p.url().includes('muse.ai'));
      if (!page) {
        console.log('ℹ️ Mở tab Muse.ai mới...');
        page = await browser.newPage();
        await page.goto('https://muse.ai/', { waitUntil: 'domcontentloaded' });
      }
      await page.bringToFront();

      /** Chờ khung nhập liệu sẵn sàng */
      await page.waitForSelector('textarea', { timeout: 15000 });
      await new Promise(r => setTimeout(r, 1500));

      /** Tải ảnh hiện tại của job từ VPS về máy tính */
      if (fs.existsSync(localImagePath)) {
        try { fs.unlinkSync(localImagePath); } catch (e) {}
      }
      console.log(`⬇️ Đang tải ảnh từ ${target.name}: ${job.imageUrl}`);
      await ztteam_downloadFile(job.imageUrl, localImagePath, target.url);
      console.log(`✅ Đã lưu ảnh tạm tại: ${localImagePath}`);

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

      console.log(`🔍 Video hiện có trên Muse: ${initialVideoSrcs.length} | Nút tải: ${initialDownloadBtnCount}`);

      /** 2. Upload ảnh đính kèm */
      console.log(`📤 Đang đính kèm ảnh vào khung chat Muse.ai...`);
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) throw new Error('Không tìm thấy input[type="file"] trên Muse.ai');
      await fileInput.uploadFile(localImagePath);
      await new Promise(r => setTimeout(r, 3000));

      /** 3. Dán prompt duy nhất 1 lần và bấm gửi */
      console.log(`✍️ Đang dán câu lệnh & nội dung câu chuyện...`);
      const textarea = await page.$('textarea');
      if (!textarea) throw new Error('Không tìm thấy ô textarea để nhập prompt');
      await textarea.click();

      /** Dán toàn bộ nội dung nguyên vẹn vào textarea */
      await page.evaluate((fullPrompt) => {
        const ta = document.querySelector('textarea');
        if (!ta) return;
        ta.focus();
        ta.value = '';
        document.execCommand('insertText', false, fullPrompt);
      }, job.prompt);
      await new Promise(r => setTimeout(r, 1200));

      console.log(`🚀 Đang bấm gửi tin nhắn (1 lần duy nhất)...`);
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

      /** 4. Chờ Muse.ai render xong video 15s */
      const timeoutMs = 420000; /** 7 phút tối đa */
      console.log(`⏳ [2/4] Đang chờ Muse.ai render video mới (tối đa 7 phút)...`);
      const startTime = Date.now();

      while (Date.now() - startTime < timeoutMs) {
        await new Promise(r => setTimeout(r, 4000));
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        const check = await page.evaluate((initialSrcs, initialBtnCount) => {
          /** Kiểm tra từ chối */
          const refusalKeywords = [
            'không tạo được video',
            'gửi ảnh khác nhé',
            'không thể tạo video',
            'vi phạm chính sách',
            'nội dung này không phù hợp',
            'thử lại với ảnh khác',
            'lỗi tạo video'
          ];
          const proses = Array.from(document.querySelectorAll('.prose, [data-message-author-role="assistant"]'));
          let refusalError = null;
          for (const prose of proses.slice(-3)) {
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

          /** BẮT BUỘC: Phải có video mới có src khác với toàn bộ video ban đầu */
          const newVideo = contentVideos.find(v => v.src && !initialSrcs.includes(v.src));

          /** Chỉ xem là xong khi thực sự có video MỚI xuất hiện */
          const isReady = newVideo && (
            hasNewBtn ||
            newVideo.duration > 3 ||
            newVideo.readyState >= 2 ||
            newVideo.src.startsWith('blob:')
          );

          return {
            isReady: !!isReady,
            count: contentVideos.length,
            hasNewBtn,
            hasNewVideo: !!newVideo,
            refusalError,
          };
        }, initialVideoSrcs, initialDownloadBtnCount);

        if (check.refusalError) {
          console.log(`\n❌ Muse.ai từ chối: "${check.refusalError}"`);
          throw new Error(`Muse.ai từ chối: ${check.refusalError}`);
        }

        process.stdout.write(`\r   ⏱️ Đang render: ${elapsedSec}s | Video count: ${check.count} | Video mới: ${check.hasNewVideo ? 'CÓ' : 'Chưa'} | Trạng thái: ${check.isReady ? 'HOÀN TẤT' : 'Đang chờ...'}`);

        if (check.isReady) {
          console.log(`\n🎉 Muse.ai đã render xong video mới sau ${elapsedSec} giây!`);
          videoRendered = true;
          break;
        }
      }

      if (!videoRendered) {
        throw new Error('Quá thời gian chờ render trên Muse.ai (timeout 7 phút)');
      }

      /** Chờ 3s để stream hoàn tất */
      await new Promise(r => setTimeout(r, 3000));

      /** 5. Trích xuất dữ liệu video blob mới */
      console.log(`💾 [3/4] Đang trích xuất dữ liệu video MP4 mới...`);
      base64Data = await page.evaluate(async (initialSrcs) => {
        const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
          const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
          return !isAvatar && v.src;
        });
        if (contentVideos.length === 0) return null;

        /** BẮT BUỘC CHỈ LẤY VIDEO CÓ SRC MỚI */
        const target = contentVideos.find(v => !initialSrcs.includes(v.src));
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
        throw new Error('Không đọc được dữ liệu video stream mới từ Muse.ai');
      }

      const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
      fs.writeFileSync(localVideoPath, buffer);
      console.log(`✅ Đã lưu file video MP4 mới: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    } finally {
      if (browser) browser.disconnect();
    }

    /** 6. Upload video MP4 lên đúng hệ thống VPS */
    console.log(`📤 [4/4] Đang tải video lên ${target.name} (${target.url}/api/image/${job.id}/attach-video)...`);
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

    console.log(`========================================================`);
    console.log(`🎉 HOÀN TẤT THÀNH CÔNG JOB #${job.id} CHO [${target.name}]!`);
    console.log(`📹 Video URL trên hệ thống: ${uploadRes.data.videoUrl}`);
    console.log(`========================================================\n`);

    /** Nghỉ an toàn sau khi tạo thành công */
    await ztteam_cooldown(SUCCESS_COOLDOWN_SEC, 'Đã tạo video thành công');
  } catch (err) {
    console.error(`\n❌ LỖI KHI XỬ LÝ JOB #${job.id}:`, err.message);

    /** Báo lỗi lên đúng hệ thống VPS */
    try {
      await axios.post(`${target.url}/api/image/${job.id}/fail-video`, { error: err.message });
      console.log(`⚠️ Đã cập nhật trạng thái FAILED lên [${target.name}].`);
    } catch (apiErr) {
      console.error(`Không thể báo lỗi lên VPS:`, apiErr.message);
    }

    /** Nghỉ an toàn sau khi gặp lỗi */
    await ztteam_cooldown(FAILURE_COOLDOWN_SEC, 'Gặp lỗi trong quá trình tạo video');
  } finally {
    /** Dọn dẹp file tạm trên máy */
    if (fs.existsSync(localImagePath)) fs.unlinkSync(localImagePath);
    if (fs.existsSync(localVideoPath)) fs.unlinkSync(localVideoPath);
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
      console.log(`\n🎯 Phát hiện bài viết cần tạo Video từ [${target.name}]: Job #${res.data.job.id}`);
      await ztteam_processVideoJobOnMuse(res.data.job, target);
      isProcessing = false;
    } else {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Đang kiểm tra [${target.name}]... (Hàng đợi trống)`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      process.stdout.write(`\r⚠️ Không kết nối được tới hệ thống... Đang thử lại`);
    } else {
      console.error(`\n[Worker Error]:`, err.message);
    }
  }
}

console.log('========================================================');
console.log('🚀 ZTTEAM MUSE REEL WORKER ĐA HỆ THỐNG ĐÃ KHỞI CHẠY!');
console.log('📋 Danh sách hệ thống phục vụ luân phiên:');
VPS_TARGETS.forEach(t => console.log(`   - ${t.name}: ${t.url}`));
console.log(`🖥️ Chrome Target : ${CHROME_DEBUG_URL}`);
console.log(`⏱️ Chu kỳ kiểm tra: mỗi ${POLL_INTERVAL_MS / 1000}s`);
console.log('🛡️ Cơ chế: Nguyên bản ổn định, chống trùng lặp video cũ 100%');
console.log('========================================================\n');

/** Chạy ngay lần đầu và duy trì chu kỳ polling */
ztteam_workerLoop();
setInterval(ztteam_workerLoop, POLL_INTERVAL_MS);
