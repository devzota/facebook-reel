import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ztteam_getStorageRoot } from '../common/ztteam_storage.util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ZTTeamSettingsService {
  private readonly logger = new Logger(ZTTeamSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ztteam_getSettings() {
    const records = await this.prisma.ztteam_settings.findMany();
    const settings: Record<string, string> = {};
    for (const r of records) {
      settings[r.key] = r.value;
    }
    return settings;
  }

  async ztteam_updateSettings(data: Record<string, string>) {
    const keys = Object.keys(data);
    for (const key of keys) {
      await this.prisma.ztteam_settings.upsert({
        where: { key },
        update: { value: String(data[key] ?? '') },
        create: { key, value: String(data[key] ?? '') },
      });
    }

    if (data['youtube_cookies'] !== undefined) {
      try {
        const cookiesPath = path.join(ztteam_getStorageRoot(), 'cookies.txt');
        fs.writeFileSync(cookiesPath, data['youtube_cookies'] || '', 'utf-8');
        this.logger.log(`Updated youtube cookies.txt file at ${cookiesPath}`);
      } catch (e: any) {
        this.logger.error(`Error saving youtube_cookies file: ${e.message}`);
      }
    }

    return { success: true };
  }
}
