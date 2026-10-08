import { Module, forwardRef } from '@nestjs/common';
import { ZTTeamImageProcessor } from './image.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamAIModule } from '../ai/ai.module';
import { ZTTeamMediaModule } from '../media/media.module';
import { ZTTeamFacebookModule } from '../facebook/facebook.module';
import { ZTTeamWordpressModule } from '../wordpress/wordpress.module';
import { ZTTeamStoryTestModule } from '../story-test/story-test.module';
import { ZTTeamCrawlerModule } from '../crawler/crawler.module';
import { ZTTeamImageRenderCron } from './image-render.cron';
import { ZTTeamImageController } from './image.controller';

@Module({
  imports: [
    PrismaModule, 
    ZTTeamAIModule, 
    ZTTeamMediaModule, 
    ZTTeamFacebookModule,
    ZTTeamWordpressModule,
    forwardRef(() => ZTTeamStoryTestModule),
    forwardRef(() => ZTTeamCrawlerModule),
  ],
  controllers: [ZTTeamImageController],
  providers: [ZTTeamImageProcessor, ZTTeamImageRenderCron],
  exports: [ZTTeamImageProcessor],
})
export class ZTTeamImageModule {}
