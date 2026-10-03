import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ZTTeamAIService } from './ai.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('ai')
@UseGuards(ZTTeamAuthGuard)
export class ZTTeamAIController {
  constructor(private readonly aiService: ZTTeamAIService) {}

  @Post('test-prompt')
  async testPrompt(@Body() data: { postContent: string; tone?: string; captionLength?: string; customPrompt?: string }) {
    const tone = data.tone || 'professional';
    const captionLength = data.captionLength || 'medium';
    const maxWords = captionLength === 'short' ? 40 : captionLength === 'long' ? 80 : 60;
    
    /** Use a small sample text if none is provided */
    const content = data.postContent || `Hôm nay là một ngày tuyệt vời để khám phá những tính năng mới của công nghệ AI. 
      Sự phát triển của AI giúp tiết kiệm hàng ngàn giờ làm việc mỗi tuần cho các nhà sáng tạo nội dung. 
      Bạn đã sẵn sàng để ứng dụng AI vào hệ thống của mình chưa?`;

    return this.aiService.ztteam_generateScript(content, tone, maxWords, data.customPrompt);
  }
}
