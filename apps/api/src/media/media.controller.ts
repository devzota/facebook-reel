import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ZTTeamYoutubeService } from './youtube.service';

@Controller('media')
export class ZTTeamMediaController {
  constructor(
    private readonly youtubeService: ZTTeamYoutubeService
  ) {}

  @Post('youtube-test')
  async ztteam_testYoutubeDownload(@Body('url') url: string) {
    if (!url) {
      throw new BadRequestException('Vui lòng cung cấp url.');
    }

    const result = await this.youtubeService.ztteam_downloadShort(url);
    
    return {
      success: true,
      message: 'Tải video thành công',
      data: result,
    };
  }
}
