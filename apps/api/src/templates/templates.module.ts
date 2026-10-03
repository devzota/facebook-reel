import { Module } from '@nestjs/common';
import { ZTTeamTemplatesController } from './templates.controller';
import { ZTTeamTemplatesService } from './templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamAuthModule } from '../auth/auth.module';
import { ZTTeamAudioModule } from '../audio/audio.module';

@Module({
  imports: [PrismaModule, ZTTeamAuthModule, ZTTeamAudioModule],
  controllers: [ZTTeamTemplatesController],
  providers: [ZTTeamTemplatesService],
  exports: [ZTTeamTemplatesService],
})
export class ZTTeamTemplatesModule {}
