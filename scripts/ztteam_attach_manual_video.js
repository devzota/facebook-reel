/**
 * ZTTeam: Công cụ gắn Video MP4 đã tải về máy vào bài viết trên VPS
 * Dùng khi video đã render xong trên Muse.ai và đã tải về máy tính
 * Cách dùng: node scripts/ztteam_attach_manual_video.js <ID_BÀI_VIẾT> <ĐƯỜNG_DẪN_FILE_MP4> [3000 hoặc 3001]
 * Tác giả: ZTTeam (ztteam.site)
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function ztteam_attachVideo() {
  const args = process.argv.slice(2);
  const postId = args[0];
  const videoFilePath = args[1];
  const portOrUrl = args[2] || '3000'; /** Mặc định auto.ztteam.site (port 3000) */

  if (!postId || !videoFilePath) {
    console.log('========================================================');
    console.log('📌 HƯỚNG DẪN SỬ DỤNG:');
    console.log('   node scripts/ztteam_attach_manual_video.js <ID_BÀI> <FILE_VIDEO.mp4> [PORT]');
    console.log('Ví dụ:');
    console.log('   node scripts/ztteam_attach_manual_video.js 7345 "C:\\Downloads\\video.mp4" 3000');
    console.log('   (Port 3000 = auto.ztteam.site | Port 3001 = reel.didinao.com)');
    console.log('========================================================');
    process.exit(1);
  }

  const resolvedVideoPath = path.resolve(videoFilePath);
  if (!fs.existsSync(resolvedVideoPath)) {
    console.error(`❌ Không tìm thấy file video tại: ${resolvedVideoPath}`);
    process.exit(1);
  }

  let baseUrl = 'http://169.58.122.248:3000';
  if (portOrUrl === '3001' || portOrUrl.includes('3001') || portOrUrl.includes('didinao')) {
    baseUrl = 'http://169.58.122.248:3001';
  } else if (portOrUrl.startsWith('http')) {
    baseUrl = portOrUrl;
  }

  const apiUrl = `${baseUrl}/api/image/${postId}/attach-video`;
  console.log('========================================================');
  console.log(`🚀 BẮT ĐẦU ĐÍNH KÈM VIDEO CHO BÀI VIẾT #${postId}`);
  console.log(`📁 File video: ${resolvedVideoPath}`);
  console.log(`🌐 Đích đến  : ${apiUrl}`);
  console.log('========================================================');

  const formData = new FormData();
  formData.append('video', fs.createReadStream(resolvedVideoPath), {
    filename: `manual_reel_${postId}.mp4`,
    contentType: 'video/mp4',
  });

  try {
    const res = await axios.post(apiUrl, formData, {
      headers: { ...formData.getHeaders() },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    });

    console.log('\n🎉 GẮN VIDEO THÀNH CÔNG!');
    console.log(`📹 Video URL trên hệ thống: ${res.data.videoUrl}`);
    console.log(`✅ Bài viết #${postId} đã sẵn sàng xuất bản lên Facebook Reel!\n`);
  } catch (err) {
    console.error('\n❌ LỖI KHI GẮN VIDEO:', err.response?.data?.message || err.message);
  }
}

ztteam_attachVideo();
