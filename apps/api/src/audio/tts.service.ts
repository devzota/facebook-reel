import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

/**
 * ZTTeamTTSService — Text-to-Speech using VieNeu-TTS (48kHz Offline) & OpenAI TTS-1.
 * Generates audio files and measures their duration via ffprobe.
 */
@Injectable()
export class ZTTeamTTSService {
  private readonly logger = new Logger('ZTTeamTTSService');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert text to speech using Revid API (CapCut Vietnamese voices like 3001 Linh) or OpenAI TTS-1.
   * @param text - The script to read
   * @param voiceId - Voice ID (e.g. '3001', 'Linh', 'alloy', 'onyx')
   * @param workDir - Directory to save the MP3 file
   * @param voiceSpeed - Speech speed multiplier
   */
  async ztteam_textToSpeech(
    text: string,
    voiceId: string = '3001',
    workDirOrPath: string,
    voiceSpeed: number = 1.0,
  ): Promise<string> {
    let outputPath: string;
    if (workDirOrPath.endsWith('.mp3')) {
      outputPath = workDirOrPath;
      const parentDir = path.dirname(outputPath);
      if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    } else {
      const filename = `voice_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp3`;
      outputPath = path.join(workDirOrPath, filename);
      if (!fs.existsSync(workDirOrPath)) fs.mkdirSync(workDirOrPath, { recursive: true });
    }
    this.logger.log(`TTS: voice=${voiceId}, speed=${voiceSpeed}, outputPath=${outputPath}`);

    /** Determine if voiceId belongs to Revid API (numeric IDs like 3001 or 'Linh') */
    const isNumericVoice = /^\d+$/.test(voiceId) || voiceId.toLowerCase().includes('linh') || voiceId === '3001';

    if (isNumericVoice) {
      this.logger.log(`Using Revid API TTS engine for voiceId: ${voiceId}`);
      try {
        const revidVoiceId = parseInt(voiceId, 10) || 3001;
        return await this.ztteam_textToSpeechRevid(text, revidVoiceId, outputPath, voiceSpeed);
      } catch (revidErr: any) {
        this.logger.warn(`Revid API TTS failed: ${revidErr.message}, falling back to OpenAI...`);
      }
    }

    const settingsDb = await this.prisma.ztteam_settings.findUnique({
      where: { key: 'openai_api_key' },
    });
    const apiKey = (settingsDb?.value || process.env.OPENAI_API_KEY || '').trim();

    if (!apiKey) {
      this.logger.warn('No OPENAI_API_KEY found, attempting Revid API TTS default...');
      try {
        return await this.ztteam_textToSpeechRevid(text, 3001, outputPath, voiceSpeed);
      } catch {
        return this.ztteam_generateSilentAudio(outputPath, 12);
      }
    }

    try {
      const openai = new OpenAI({ apiKey });
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: (voiceId === 'alloy' || !voiceId || isNumericVoice ? 'alloy' : voiceId) as any,
        input: text,
        speed: voiceSpeed,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      this.logger.log(`TTS audio saved: ${outputPath} (${buffer.length} bytes)`);
      return outputPath;
    } catch (error: any) {
      this.logger.error(`TTS failed: ${error.message}`);
      throw new Error('Lỗi tạo giọng đọc: ' + error.message);
    }
  }

  /**
   * Convert text to speech using Revid API (CapCut Vietnamese voices).
   * @param text - Text script
   * @param voiceId - Revid numeric voice ID (default 3001 Linh)
   * @param outputPath - Local file path to write MP3
   * @param speed - Speech speed multiplier
   */
  async ztteam_textToSpeechRevid(
    text: string,
    voiceId: number = 3001,
    outputPath: string,
    speed: number = 1.0,
  ): Promise<string> {
    const settingsDb = await this.prisma.ztteam_settings.findUnique({
      where: { key: 'revid_api_key' },
    });
    const apiKey = (settingsDb?.value || process.env.REVID_API_KEY || 'sk_Ci024Gx0lcui8TsdQXDEKTI6W2aL3D0D').trim();

    this.logger.log(`Calling Revid API TTS: voice_id=${voiceId}, speed=${speed}, textLength=${text.length}`);

    const res = await axios.post('https://api.revidapi.com/paid/text-to-speech', {
      text: text,
      voice_id: voiceId,
      speed: speed,
      id: `ztteam-${Date.now()}`
    }, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 15000,
    });

    const item = Array.isArray(res.data) ? res.data[0] : res.data;
    let getResultUrl = item?.get_result || (item?.task_id ? `https://tts.revidapi.com/api/get/${item.task_id}` : null);
    let audioUrl = item?.audio_url || item?.response?.audio_url;

    /** If processing asynchronously, poll get_result endpoint until ready */
    if (!audioUrl && getResultUrl) {
      this.logger.log(`Revid TTS task queued, polling result from ${getResultUrl}`);
      let attempts = 0;
      while (attempts < 25) {
        await new Promise(r => setTimeout(r, 1500));
        attempts++;
        try {
          const pollRes = await axios.get(getResultUrl, {
            headers: { 'x-api-key': apiKey },
            timeout: 10000,
          });

          const pollItem = Array.isArray(pollRes.data) ? pollRes.data[0] : pollRes.data;
          
          if (pollItem?.audio_url || pollItem?.response?.audio_url || pollItem?.result?.audio_url) {
            audioUrl = pollItem.audio_url || pollItem.response?.audio_url || pollItem.result?.audio_url;
            this.logger.log(`Revid TTS poll #${attempts} succeeded! Audio URL: ${audioUrl}`);
            break;
          }
          if (pollItem?.status === 'failed' || pollItem?.error) {
            throw new Error(pollItem?.error || pollItem?.message || 'Revid API task failed');
          }
        } catch (pollErr: any) {
          this.logger.warn(`Revid TTS poll #${attempts} warning: ${pollErr.message}`);
        }
      }
    }

    if (!audioUrl) {
      throw new Error('Không nhận được link âm thanh từ Revid API');
    }

    /** Download audio file to local path */
    const audioRes = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    fs.writeFileSync(outputPath, Buffer.from(audioRes.data));
    this.logger.log(`Revid TTS audio downloaded & saved: ${outputPath} (${audioRes.data.byteLength} bytes)`);
    return outputPath;
  }

  /**
   * Get audio duration in seconds using ffprobe.
   * @param filePath - Path to the audio file
   * @returns Duration in seconds
   */
  ztteam_getAudioDuration(filePath: string): number {
    try {
      const result = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
        { encoding: 'utf-8' },
      );
      const duration = parseFloat(result.trim());
      this.logger.log(`Audio duration: ${duration}s for ${filePath}`);
      return duration;
    } catch (error: any) {
      this.logger.error(`ffprobe failed: ${error.message}`);
      /** Fallback: estimate ~12 seconds if ffprobe unavailable */
      return 12;
    }
  }

  /**
   * Generate a silent audio file as fallback when no API key is available.
   * Uses ffmpeg to create a silent MP3 of specified duration.
   */
  private ztteam_generateSilentAudio(outputPath: string, durationSec: number): string {
    try {
      execSync(
        `ffmpeg -y -f lavfi -i anullsrc=r=44100:cl=mono -t ${durationSec} -q:a 9 "${outputPath}"`,
        { stdio: 'pipe' },
      );
    } catch {
      /** If ffmpeg fails, create a tiny placeholder file */
      fs.writeFileSync(outputPath, Buffer.alloc(1024));
    }
    return outputPath;
  }
}
