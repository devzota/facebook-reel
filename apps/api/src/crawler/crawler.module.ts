import { Module, forwardRef } from '@nestjs/common';
import { ZTTeamCrawlerService } from './crawler.service';
import { ZTTeamCrawlerController } from './crawler.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ZTTeamFetcherService } from './fetcher.service';
import { ZTTeamCrawlerCron } from './crawler.cron';
import { ZTTeamWordpressModule } from '../wordpress/wordpress.module';
import { ZTTeamStoryTestModule } from '../story-test/story-test.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    PrismaModule,
    ZTTeamWordpressModule,
    TelegramModule,
    forwardRef(() => ZTTeamStoryTestModule),
  ],
  providers: [ZTTeamCrawlerService, ZTTeamFetcherService, ZTTeamCrawlerCron],
  controllers: [ZTTeamCrawlerController],
  exports: [ZTTeamFetcherService, ZTTeamCrawlerService],
})
export class ZTTeamCrawlerModule {}

