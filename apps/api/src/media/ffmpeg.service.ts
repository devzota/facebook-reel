import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * ZTTeamFFmpegService — Wrapper around FFmpeg CLI for video rendering.
 * Handles image preprocessing, slideshow creation, and final video composition.
 */
@Injectable()
export class ZTTeamFFmpegService {
  private readonly logger = new Logger('ZTTeamFFmpegService');

  /**
   * Helper method to execute FFmpeg asynchronously with low CPU priority
   * to prevent blocking the Node.js event loop and ensure Web API stays fast.
   */
  async ztteam_runFfmpeg(cmd: string, timeoutMs: number = 180000): Promise<void> {
    const isLinux = process.platform === 'linux';
    const finalCmd = isLinux ? `nice -n 15 ${cmd}` : cmd;
    await execAsync(finalCmd, { maxBuffer: 10 * 1024 * 1024, timeout: timeoutMs });
  }

  /**
   * Prepare an image for 9:16 vertical video (1080x1920).
   * If the image is horizontal, it adds a blurred background to fill the vertical frame.
   * @param imagePath - Path to the source image
   * @param outputPath - Path to save the processed image
   */
  async ztteam_prepareImage(
    imagePath: string, 
    outputPath: string,
    vw: number = 1080,
    vh: number = 1920,
    vx: number = 0,
    vy: number = 0
  ): Promise<void> {
    this.logger.log(`Preparing image: ${imagePath} for frame ${vw}x${vh}`);

    /**
     * Keep original image ratio (fit) and fill the rest with a blurred version of the same image
     */
    const cmd = `ffmpeg -y -i "${imagePath}" -vf "split[original][copy];[copy]scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh},boxblur=20:20[bg];[original]scale=${vw}:${vh}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2" -frames:v 1 "${outputPath}"`;

    try {
      await this.ztteam_runFfmpeg(cmd, 30000);
      this.logger.log(`Image prepared: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`Image preparation failed: ${error.message}`);
      throw new Error(`Lỗi xử lý ảnh: ${error.message}`);
    }
  }

  /**
   * Create a butter-smooth cinematic motion video (2.5D Ken Burns zoom) from a single 2K image.
   * Uses floating-point sub-pixel bicubic scaling with eval=frame to eliminate micro-jitter completely.
   * @param imagePath - Path to source image
   * @param duration - Duration in seconds
   * @param outputPath - Path to save video
   * @param motionStyle - Style of motion: ambient_zoom (blurred bg + crisp zoom) or cinematic_zoom
   */
  async ztteam_createSingleImageMotionVideo(
    imagePath: string,
    duration: number,
    outputPath: string,
    motionStyle: 'ambient_zoom' | 'cinematic_zoom' = 'ambient_zoom',
    vw: number = 1080,
    vh: number = 1920,
  ): Promise<void> {
    this.logger.log(`Creating butter-smooth motion video: ${imagePath}, style=${motionStyle}, ${duration}s`);
    const workDir = path.dirname(outputPath);
    const bgPath = path.join(workDir, `motion_bg_${Date.now()}.jpg`);
    const fgBasePath = path.join(workDir, `motion_fg_${Date.now()}.jpg`);

    try {
      /** Step 1: Pre-generate static blurred 9:16 background once (ultra-fast ~0.2s) */
      const bgCmd = `ffmpeg -y -i "${imagePath}" -vf "scale=${vw}:${vh}:force_original_aspect_ratio=increase,crop=${vw}:${vh},boxblur=25:10" -frames:v 1 "${bgPath}"`;
      await this.ztteam_runFfmpeg(bgCmd, 20000);

      /** Step 2: Pre-scale foreground base once to 1200x1200 */
      const fgCmd = `ffmpeg -y -i "${imagePath}" -vf "scale=${vw}:${vw}:force_original_aspect_ratio=decrease" -frames:v 1 "${fgBasePath}"`;
      await this.ztteam_runFfmpeg(fgCmd, 20000);

      /** Step 3: Render smooth bicubic zoom (eval=frame calculates sub-pixel bicubic on each frame with 0 jitter) */
      const zoomFactor = motionStyle === 'cinematic_zoom' ? 0.18 : 0.12;
      const compositeCmd = `ffmpeg -y -loop 1 -t ${duration} -i "${bgPath}" -loop 1 -t ${duration} -i "${fgBasePath}" -filter_complex "[1:v]scale='${vw}*(1+${zoomFactor}*t/${duration})':-1:eval=frame:flags=bicubic[fg];[0:v][fg]overlay=(W-w)/2:(H-h)/2" -c:v libx264 -preset veryfast -pix_fmt yuv420p "${outputPath}"`;
      await this.ztteam_runFfmpeg(compositeCmd, 60000);

      this.logger.log(`Butter-smooth motion video created: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`Motion video creation failed: ${error.message}`);
      throw new Error(`Lỗi tạo video chuyển động mượt: ${error.message}`);
    } finally {
      /** Clean up temporary pre-scaled images */
      try {
        if (fs.existsSync(bgPath)) fs.unlinkSync(bgPath);
        if (fs.existsSync(fgBasePath)) fs.unlinkSync(fgBasePath);
      } catch (e) {
        /** Ignore cleanup error */
      }
    }
  }
  /**
   * Create a slideshow video from prepared images with Ken Burns effect.
   * Each image is shown for (totalDuration / imageCount) seconds.
   * @param images - Array of image file paths (already 1080x1920)
   * @param totalDuration - Total video duration in seconds
   * @param outputPath - Path to save the slideshow video
   */
  async ztteam_createSlideshow(
    images: string[],
    totalDuration: number,
    outputPath: string,
    vw: number = 1080,
    vh: number = 1920
  ): Promise<void> {
    this.logger.log(`Creating slideshow: ${images.length} images, ${totalDuration}s`);

    if (images.length === 0) {
      throw new Error('Không có ảnh để tạo slideshow');
    }

    const fps = 30;
    
    /** For xfade, we need overlaps. Let's define a crossfade duration (e.g. 1 second). */
    const transitionDuration = 1;
    const baseImageDur = 5; /** Each image shows for roughly 5 seconds max */
    
    /** Calculate how many segments we need to fill totalDuration */
    let numImages = images.length;
    let actualN = Math.max(numImages, Math.ceil((totalDuration - transitionDuration) / (baseImageDur - transitionDuration)));
    if (actualN < 1) actualN = 1;
    
    const imageDur = actualN > 1 
      ? (totalDuration + (actualN - 1) * transitionDuration) / actualN
      : totalDuration;

    let inputs = '';
    let filterComplex = '';

    for (let i = 0; i < actualN; i++) {
      const imgPath = images[i % images.length];
      inputs += `-loop 1 -t ${imageDur} -i "${imgPath}" `;
      /** Just ensure it's in yuv420p format (no zoompan to avoid jitter) */
      filterComplex += `[${i}:v]format=yuv420p[v${i}];`;
    }

    if (actualN === 1) {
      filterComplex += `[v0]copy[vout]`;
    } else {
      let lastOut = `v0`;
      const xfadeTransitions = [
        'fade', 'wipeleft', 'wiperight', 'wipeup', 'wipedown',
        'slideleft', 'slideright', 'slideup', 'slidedown',
        'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
        'rectcrop', 'circlecrop', 'circleclose', 'circleopen',
        'horzclose', 'horzopen', 'vertclose', 'vertopen',
        'diagbl', 'diagbr', 'diagtl', 'diagtr',
        'hlslice', 'hrslice', 'vuslice', 'vdslice',
        'distance', 'radial'
      ];
      
      for (let i = 1; i < actualN; i++) {
        const offset = (imageDur - transitionDuration) * i;
        const isLast = i === actualN - 1;
        const outName = isLast ? 'vout' : `v_fade_${i}`;
        const randomTransition = xfadeTransitions[Math.floor(Math.random() * xfadeTransitions.length)];
        filterComplex += `[${lastOut}][v${i}]xfade=transition=${randomTransition}:duration=${transitionDuration}:offset=${offset}[${outName}]${isLast ? '' : ';'}`;
        lastOut = outName;
      }
    }

    filterComplex = filterComplex.replace(/;+$/, '');

    const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vout]" -c:v libx264 -preset fast -t ${totalDuration} "${outputPath}"`;

    try {
      await this.ztteam_runFfmpeg(cmd, 120000);
      this.logger.log(`Slideshow created: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`Slideshow creation failed: ${error.message}`);
      throw new Error(`Lỗi tạo slideshow đa hiệu ứng: ${error.message}`);
    }
  }

  /**
   * Final merge: combine slideshow + voice + background music + overlay + subtitles.
   * @param options - All input file paths and output path
   */
  async ztteam_mergeAll(options: {
    slideshowPath: string;
    voicePath: string;
    bgMusicPath?: string;
    overlayPath: string;
    subtitlePath: string;
    outputPath: string;
    duration: number;
    videoX: number;
    videoY: number;
    bgImagePath?: string;
  }): Promise<void> {
    this.logger.log('Final merge starting...');

    const { slideshowPath, voicePath, bgMusicPath, overlayPath, subtitlePath, outputPath, duration, videoX, videoY } = options;

    /**
     * FFmpeg complex filter chain:
     * 1. Input 0: slideshow video (vw x vh)
     * 2. Input 1: overlay PNG (1080x1920, transparent)
     * 3. Input 2: voice audio
     * 4. Input 3: background music (optional)
     *
     * Filters:
     * - Create a 1080x1920 black/transparent canvas
     * - Overlay the slideshow video onto the canvas at videoX, videoY
     * - Overlay the PNG on top of the canvas
     * - Mix voice audio with background music (music at -15dB)
     * - Burn ASS subtitles into the video
     */
    let inputs = '';
    let filterComplex = '';

    if (options.bgImagePath && fs.existsSync(options.bgImagePath)) {
      inputs = `-loop 1 -t ${duration} -i "${options.bgImagePath}" -i "${slideshowPath}" -i "${overlayPath}" -i "${voicePath}"`;
      filterComplex = `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];[1:v]format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lt(Y,800),255,if(gt(Y,1280),0,255*pow((1280-Y)/480,2)))'[slide_faded];[bg][slide_faded]overlay=x=${videoX}:y=${videoY}[base];[base][2:v]overlay=0:0[withoverlay];[withoverlay]ass='${subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}':fontsdir=assets[vout]`;
    } else {
      /** Dynamic blurred background from the slideshow itself. We add a dummy color input (0:v) to keep indices consistent. */
      inputs = `-f lavfi -i color=c=black:s=10x10 -stream_loop -1 -i "${slideshowPath}" -i "${overlayPath}" -i "${voicePath}"`;
      filterComplex = `[1:v]scale=216:384:force_original_aspect_ratio=increase,crop=216:384,boxblur=10:10,scale=1080:1920[bg];[bg][1:v]overlay=x=${videoX}:y=${videoY}[base];[base][2:v]overlay=0:0[withoverlay];[withoverlay]ass='${subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:')}':fontsdir=assets[vout]`;
    }
    let audioMap = '';

    if (bgMusicPath && fs.existsSync(bgMusicPath)) {
      inputs += ` -i "${bgMusicPath}"`;
      filterComplex += `;[3:a]volume=1.0[voice];[4:a]volume=0.15,afade=t=out:st=${duration - 2}:d=2[music];[voice][music]amix=inputs=2:duration=first[aout]`;
      audioMap = '-map "[aout]"';
    } else {
      audioMap = '-map 3:a';
    }

    const cmd = `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vout]" ${audioMap} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -shortest -t ${duration} "${outputPath}"`;

    try {
      await this.ztteam_runFfmpeg(cmd, 180000);
      this.logger.log(`Final video rendered: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`Final merge failed: ${error.message}`);
      throw new Error(`Lỗi ghép video cuối: ${error.message}`);
    }
  }

  /**
   * Generate a thumbnail from a video at 1 second mark.
   */
  async ztteam_generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
    const cmd = `ffmpeg -y -i "${videoPath}" -ss 1 -frames:v 1 -vf "scale=540:960" "${outputPath}"`;
    try {
      await this.ztteam_runFfmpeg(cmd, 15000);
    } catch (error: any) {
      this.logger.warn(`Thumbnail generation failed: ${error.message}`);
    }
  }
}
