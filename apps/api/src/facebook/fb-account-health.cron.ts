import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ZTTeamFacebookService } from './facebook.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FBAccountHealthCron — Tự động kiểm tra sức khỏe Token Facebook Accounts & Fanpages định kỳ
 * Cảnh báo sớm qua Telegram trước khi đến thời điểm đăng bài.
 */
@Injectable()
export class FBAccountHealthCron {
  private readonly logger = new Logger(FBAccountHealthCron.name);

  constructor(
    private readonly facebookService: ZTTeamFacebookService,
    private readonly prisma: PrismaService,
  ) {}

  /** Chạy kiểm tra định kỳ mỗi 30 phút */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async ztteam_handleAccountHealthCheck() {
    this.logger.log('Starting scheduled Facebook Accounts & Fanpages health check...');
    try {
      const users = await this.prisma.ztteam_users.findMany({ select: { id: true } });
      for (const user of users) {
        await this.facebookService.ztteam_checkAccountHealth(user.id);
      }
      this.logger.log('Scheduled Facebook health check completed!');
    } catch (error: any) {
      this.logger.error(`Error in scheduled Facebook health check: ${error.message}`);
    }
  }
}
