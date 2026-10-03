import { Module } from '@nestjs/common';
import { ZTTeamFFmpegService } from './ffmpeg.service';
import { ZTTeamPuppeteerService } from './puppeteer.service';
import { ZTTeamYoutubeService } from './youtube.service';
import { ZTTeamMediaController } from './media.controller';

@Module({
  controllers: [ZTTeamMediaController],
  providers: [ZTTeamFFmpegService, ZTTeamPuppeteerService, ZTTeamYoutubeService],
  exports: [ZTTeamFFmpegService, ZTTeamPuppeteerService, ZTTeamYoutubeService],
})
export class ZTTeamMediaModule {}
