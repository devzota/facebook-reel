import { Module } from '@nestjs/common';
import { ZTTeamRenderProcessor } from './render.processor';
import { ZTTeamRenderController } from './render.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamAIModule } from '../ai/ai.module';
import { ZTTeamAudioModule } from '../audio/audio.module';
import { ZTTeamMediaModule } from '../media/media.module';
import { ZTTeamFacebookModule } from '../facebook/facebook.module';
import { ZTTeamRenderCron } from './render.cron';
import { ZTTeamPublisherCron } from './publisher.cron';
import { ZTTeamWordpressModule } from '../wordpress/wordpress.module';

@Module({
  imports: [
    PrismaModule, 
    ZTTeamAIModule, 
    ZTTeamAudioModule, 
    ZTTeamMediaModule, 
    ZTTeamFacebookModule,
    ZTTeamWordpressModule
  ],
  controllers: [ZTTeamRenderController],
  providers: [ZTTeamRenderProcessor, ZTTeamRenderCron, ZTTeamPublisherCron],
  exports: [ZTTeamRenderProcessor],
})
export class ZTTeamRenderModule {}
