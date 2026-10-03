import { Module } from '@nestjs/common';
import { ZTTeamDashboardController } from './dashboard.controller';
import { ZTTeamDashboardService } from './dashboard.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamFacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [PrismaModule, ZTTeamFacebookModule],
  controllers: [ZTTeamDashboardController],
  providers: [ZTTeamDashboardService],
})
export class ZTTeamDashboardModule {}
