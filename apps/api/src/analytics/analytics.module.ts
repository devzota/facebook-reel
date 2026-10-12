import { Module } from '@nestjs/common';
import { ZTTeamAnalyticsService } from './analytics.service';
import { ZTTeamAnalyticsController } from './analytics.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamAuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, ZTTeamAuthModule],
  controllers: [ZTTeamAnalyticsController],
  providers: [ZTTeamAnalyticsService],
  exports: [ZTTeamAnalyticsService],
})
export class ZTTeamAnalyticsModule {}
