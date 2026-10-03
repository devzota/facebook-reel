import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('telegram')
@UseGuards(ZTTeamAuthGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('test')
  async ztteam_test(@Body() body: { token: string; chatId: string }) {
    if (!body.token || !body.chatId) {
      return { success: false, message: 'Vui lòng nhập Token và Chat ID' };
    }
    
    try {
      const success = await this.telegramService.ztteam_testMessage(body.token, body.chatId);
      return { success };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
