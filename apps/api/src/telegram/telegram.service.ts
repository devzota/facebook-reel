import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ztteam_sendMessage(message: string): Promise<boolean> {
    try {
      const tokenSetting = await this.prisma.ztteam_settings.findUnique({ where: { key: 'telegram_bot_token' } });
      const chatIdSetting = await this.prisma.ztteam_settings.findUnique({ where: { key: 'telegram_chat_id' } });

      const token = tokenSetting?.value;
      const chatId = chatIdSetting?.value;

      if (!token || !chatId) {
        /** Silently skip if not configured */
        return false;
      }

      await this.ztteam_executeSend(token, chatId, message);
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram message: ${error.message}`);
      return false;
    }
  }

  async ztteam_testMessage(token: string, chatId: string): Promise<boolean> {
    const message = `🔔 *Thông báo từ ZT-Reel System*\n\n✅ Kết nối Telegram thành công!\nHệ thống sẽ gửi các thông báo lỗi tự động vào nhóm/chat này.`;
    return this.ztteam_executeSend(token, chatId, message);
  }

  private async ztteam_executeSend(token: string, chatId: string, text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
      await axios.post(url, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      });
      return true;
    } catch (error: any) {
      this.logger.warn(`Telegram Markdown send failed (${error.response?.data?.description || error.message}), retrying as plain text...`);
      try {
        const cleanText = text.replace(/\*/g, '');
        await axios.post(url, {
          chat_id: chatId,
          text: cleanText
        });
        return true;
      } catch (fallbackError: any) {
        this.logger.error(`Telegram API Error: ${fallbackError.response?.data?.description || fallbackError.message}`);
        throw new Error(fallbackError.response?.data?.description || 'Lỗi kết nối đến Telegram API');
      }
    }
  }
}
