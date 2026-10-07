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
const VPS_BASE_URL = process.env.VPS_API_URL || 'http://169.58.122.248:3000';
const API_URL = `${VPS_BASE_URL}/api`;
const CHROME_DEBUG_URL = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9222';
const POLL_INTERVAL_MS = 15000; /** 15 giây kiểm tra hàng đợi một lần */
const TEMP_DIR = path.resolve(__dirname, '../scratch/worker_temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/** Biến trạng thái worker */
let isProcessing = false;

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

      /** Đếm số video hiện có (loại trừ avatar tròn 480x480) */
      const initialVideosCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('video')).filter(v => {
          const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
          return !isAvatar;
        }).length;
      });

      /** 3. Upload ảnh */
      console.log(`📤 [3/5] Đang đính kèm ảnh vào khung chat Muse.ai...`);
      const fileInput = await page.$('input[type="file"]');
      if (!fileInput) throw new Error('Không tìm thấy input[type="file"] trên Muse.ai');
      await fileInput.uploadFile(localImagePath);
      await new Promise(r => setTimeout(r, 3000));

      /** 4. Nhập prompt và gửi */
      console.log(`✍️ [4/5] Đang nhập câu lệnh: "${job.prompt.slice(0, 80)}..."`);
      const textarea = await page.$('textarea');
      if (!textarea) throw new Error('Không tìm thấy ô textarea để nhập prompt');
      await textarea.click();
      await page.keyboard.type(job.prompt, { delay: 15 });
      await new Promise(r => setTimeout(r, 1000));

      console.log(`🚀 Đang bấm gửi tin nhắn...`);
      await page.keyboard.press('Enter');

      /** 5. Chờ Muse.ai render xong video 15s */
      console.log(`⏳ [5/5] Đang chờ Muse.ai render video (tối đa 3.5 phút)...`);
      const startTime = Date.now();
      const timeoutMs = 210000;
      let videoRendered = false;

      while (Date.now() - startTime < timeoutMs) {
        await new Promise(r => setTimeout(r, 4000));
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);

        const check = await page.evaluate((initialCount) => {
          const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
            const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
            return !isAvatar;
          });

          const currentCount = contentVideos.length;
          const hasNew = currentCount > initialCount;
          const lastVideo = contentVideos[contentVideos.length - 1];
          const isReady = hasNew && lastVideo && lastVideo.duration > 3 && !lastVideo.seeking;

          return {
            hasNew,
            isReady,
            count: currentCount,
            duration: lastVideo ? lastVideo.duration : 0,
          };
        }, initialVideosCount);

        process.stdout.write(`\r   ⏱️ Đang render: ${elapsedSec}s | Video count: ${check.count} | Ready: ${check.isReady ? 'CÓ' : 'Đang chờ...'}`);

        if (check.isReady) {
          console.log(`\n🎉 Muse.ai đã render xong video sau ${elapsedSec} giây!`);
          videoRendered = true;
          break;
        }
      }

      if (!videoRendered) {
        throw new Error('Quá thời gian chờ render (timeout 3.5 phút)');
      }

      /** Chờ 3s để stream hoàn tất */
      await new Promise(r => setTimeout(r, 3000));

      /** Trích xuất dữ liệu video blob */
      console.log(`💾 Đang trích xuất dữ liệu video MP4...`);
      const base64Data = await page.evaluate(async () => {
        const contentVideos = Array.from(document.querySelectorAll('video')).filter(v => {
          const isAvatar = v.closest('.rounded-full') !== null || (v.videoWidth === 480 && v.videoHeight === 480);
          return !isAvatar && v.src;
        });
        if (contentVideos.length === 0) return null;
        const target = contentVideos[contentVideos.length - 1];
        const res = await fetch(target.src);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      });

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
  } catch (err) {
    console.error(`\n❌ LỖI KHI XỬ LÝ JOB #${job.id}:`, err.message);

    /** Báo lỗi lên VPS để không bị kẹt trạng thái */
    try {
      await axios.post(`${API_URL}/image/${job.id}/fail-video`, { error: err.message });
      console.log(`⚠️ Đã cập nhật trạng thái FAILED lên VPS.`);
    } catch (apiErr) {
      console.error(`Không thể báo lỗi lên VPS:`, apiErr.message);
    }
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

    /** 2. Hỏi VPS xem có job PENDING không */
    const res = await axios.get(`${API_URL}/image/pending-video`, { timeout: 10000 });
    if (res.data && res.data.hasJob && res.data.job) {
      isProcessing = true;
      await ztteam_processVideoJobOnMuse(res.data.job);
      isProcessing = false;
    } else {
      process.stdout.write(`\r[${new Date().toLocaleTimeString()}] Đang lắng nghe VPS... (Chưa có bài nào trong hàng đợi PENDING)`);
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
