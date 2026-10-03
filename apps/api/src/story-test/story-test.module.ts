import { Module, forwardRef } from '@nestjs/common';
import { ZTTeamAIModule } from '../ai/ai.module';
import { ZTTeamMediaModule } from '../media/media.module';
import { ZTTeamCrawlerModule } from '../crawler/crawler.module';
import { ZTTeamStoryTestController } from './story-test.controller';
import { ZTTeamStoryTestService } from './story-test.service';

/**
 * Isolated Story Test Module
 */
@Module({
  imports: [ZTTeamAIModule, ZTTeamMediaModule, forwardRef(() => ZTTeamCrawlerModule)],
  controllers: [ZTTeamStoryTestController],
  providers: [ZTTeamStoryTestService],
  exports: [ZTTeamStoryTestService],
})
export class ZTTeamStoryTestModule {}

