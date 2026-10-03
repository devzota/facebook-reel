import { Module } from '@nestjs/common';
import { ZTTeamSettingsController } from './settings.controller';
import { ZTTeamSettingsService } from './settings.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ZTTeamSettingsController],
  providers: [ZTTeamSettingsService],
})
export class ZTTeamSettingsModule {}
