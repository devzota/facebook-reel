import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { ztteam_getReelsPath, ztteam_getImagesPath } from '../common/ztteam_storage.util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ZTTeamStorageCleanupCron {
  private readonly logger = new Logger(ZTTeamStorageCleanupCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  /** Run every day at 02:00 AM */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async ztteam_handleCron() {
    this.logger.log('Starting daily storage cleanup...');
    try {
      /** Fetch retention days from settings */
      const setting = await this.prisma.ztteam_settings.findUnique({ where: { key: 'video_retention_days' } });
      const retentionDays = setting ? parseInt(setting.value, 10) : 7;
      
      if (isNaN(retentionDays) || retentionDays <= 0) {
        this.logger.log('Retention days is invalid or disabled. Skipping cleanup.');
        return;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      this.logger.log(`Cleaning up files older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

      let deletedReelsCount = 0;
      let deletedImagesCount = 0;

      /** Cleanup Reels */
      const oldReels = await this.prisma.ztteam_reels.findMany({
        where: {
          created_at: { lt: cutoffDate },
          is_posted: true,
          video_url: { not: 'DELETED' },
        },
      });

      for (const reel of oldReels) {
        const reelDir = ztteam_getReelsPath(reel.id);
        if (fs.existsSync(reelDir)) {
          const files = fs.readdirSync(reelDir);
          for (const file of files) {
            if (file.match(/\.(mp4|webm|mkv|mp3|m4a|wav)$/i)) {
              fs.unlinkSync(path.join(reelDir, file));
            }
          }
        }
        await this.prisma.ztteam_reels.update({
          where: { id: reel.id },
          data: { video_url: 'DELETED' },
        });
        deletedReelsCount++;
      }

      this.logger.log(`Cleanup complete. Deleted ${deletedReelsCount} old posted reels.`);
      
      if (deletedReelsCount > 0) {
        this.telegramService.ztteam_sendMessage(
          `🧹 *[DỌN DẸP Ổ CỨNG ĐỊNH KỲ]*\n\n` +
          `Đã xóa tự động các file video/audio cũ hơn ${retentionDays} ngày:\n` +
          `• Video đã đăng: ${deletedReelsCount} bài`
        );
      }

    } catch (error: any) {
      this.logger.error(`Storage cleanup failed: ${error.message}`);
      this.telegramService.ztteam_sendMessage(
        `🚨 *[LỖI DỌN DẸP Ổ CỨNG]*\n\n` +
        `• *Lỗi:* ${error.message}`
      );
    }
  }
}
