import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ztteam_getYoutubePath } from '../common/ztteam_storage.util';

const execAsync = promisify(exec);

export interface ZTTeamYoutubeMetadata {
  id: string;
  title: string;
  duration: number;
  width: number;
  height: number;
}

export interface ZTTeamYoutubeDownloadResult {
  filePath: string;
  url: string;
  metadata: ZTTeamYoutubeMetadata;
}

@Injectable()
export class ZTTeamYoutubeService {
  private readonly logger = new Logger(ZTTeamYoutubeService.name);

  /**
   * Tải video từ YouTube Shorts sử dụng yt-dlp.
   * @param url Link YouTube (Shorts)
   */
  async ztteam_downloadShort(url: string): Promise<ZTTeamYoutubeDownloadResult> {
    const youtubeDir = ztteam_getYoutubePath();
    if (!fs.existsSync(youtubeDir)) {
      fs.mkdirSync(youtubeDir, { recursive: true });
    }

    this.logger.log(`Start downloading YouTube Short: ${url}`);

    /** Trích xuất ID sơ bộ để tránh lỗi, yt-dlp sẽ dùng %(id)s */
    let tempId = 'unknown';
    try {
      const urlObj = new URL(url);
      if (urlObj.pathname.includes('/shorts/')) {
        tempId = urlObj.pathname.split('/shorts/')[1].split('?')[0];
      }
    } catch (e) {
      /** Ignore */
    }

    /** Random delay 1-3 seconds to avoid rate limiting */
    const delayMs = Math.floor(Math.random() * 2000) + 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    /**
     * Dùng yt-dlp:
     * - format: H.264 (avc1) + AAC (m4a), fallback mp4
     * - output: %(id)s.%(ext)s
     * - write-info-json: Xuất metadata ra file json
     */
    const outputTemplate = path.join(youtubeDir, '%(id)s.%(ext)s');
    const cmd = `yt-dlp --format "bv*[vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]/b" --output "${outputTemplate}" --write-info-json --no-warnings "${url}"`;

    try {
      await execAsync(cmd, { timeout: 120000 }); /** 2 phút timeout */
    } catch (error: any) {
      this.logger.error(`yt-dlp failed for ${url}: ${error.message}`);
      throw new BadRequestException(`Lỗi tải video YouTube: ${error.message}`);
    }

    /** Tìm file .info.json vừa tạo để đọc metadata */
    const files = fs.readdirSync(youtubeDir);
    const jsonFile = files.find(f => f.endsWith('.info.json') && (!tempId || tempId === 'unknown' || f.includes(tempId)));

    if (!jsonFile) {
      this.logger.error(`Cannot find .info.json after downloading ${url}`);
      throw new BadRequestException('Tải video thành công nhưng không lấy được metadata.');
    }

    const jsonPath = path.join(youtubeDir, jsonFile);
    let metadata: any;
    try {
      const jsonContent = fs.readFileSync(jsonPath, 'utf8');
      metadata = JSON.parse(jsonContent);
      /** Clean up the info json file */
      fs.unlinkSync(jsonPath);
    } catch (err) {
      this.logger.error(`Failed to parse json metadata for ${url}`);
      throw new BadRequestException('Lỗi trích xuất metadata từ video.');
    }

    const videoId = metadata.id;
    let videoFilePath = path.join(youtubeDir, `${videoId}.mp4`);

    if (!fs.existsSync(videoFilePath)) {
      /** Trong một số trường hợp fallback, yt-dlp có thể xuất ra mkv hoặc webm */
      videoFilePath = path.join(youtubeDir, `${videoId}.${metadata.ext}`);
      if (!fs.existsSync(videoFilePath)) {
        throw new BadRequestException('Video tải về nhưng không tìm thấy file đầu ra.');
      }
    }

    /** Sử dụng FFprobe để xác minh lại codec và định dạng thực tế */
    const ffprobeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of json "${videoFilePath}"`;
    try {
      const { stdout } = await execAsync(ffprobeCmd);
      const probeData = JSON.parse(stdout);
      const vStream = probeData.streams?.[0];
      
      if (!vStream) {
        throw new Error('Không tìm thấy luồng video (stream)');
      }

      this.logger.log(`Downloaded Short ${videoId}. Codec: ${vStream.codec_name}, Res: ${vStream.width}x${vStream.height}`);

    } catch (err: any) {
      this.logger.error(`FFprobe verification failed for ${videoFilePath}: ${err.message}`);
      fs.unlinkSync(videoFilePath); /** Xóa file lỗi */
      throw new BadRequestException(`File video không hợp lệ hoặc bị hỏng trong quá trình tải.`);
    }

    const fileName = path.basename(videoFilePath);

    return {
      filePath: videoFilePath,
      url: `/storage/youtube/${fileName}`,
      metadata: {
        id: videoId,
        title: metadata.title || '',
        duration: metadata.duration || 0,
        width: metadata.width || 1080,
        height: metadata.height || 1920,
      }
    };
  }
}
