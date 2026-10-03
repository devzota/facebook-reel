import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ZTTeamFacebookService } from './facebook.service';
import { ZTTeamFacebookController } from './facebook.controller';
import { FBAccountHealthCron } from './fb-account-health.cron';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamUsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [HttpModule, PrismaModule, ZTTeamUsersModule, TelegramModule],
  providers: [ZTTeamFacebookService, FBAccountHealthCron],
  controllers: [ZTTeamFacebookController],
  exports: [ZTTeamFacebookService],
})
export class ZTTeamFacebookModule {}
