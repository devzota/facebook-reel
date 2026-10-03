import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
/** @ts-ignore */
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ZTTeamTemplatesService } from './templates.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';
import { ztteam_getTemplatesPath } from '../common/ztteam_storage.util';
import { ZTTeamTTSService } from '../audio/tts.service';

@Controller('templates')
/** @UseGuards(ZTTeamAuthGuard) */
export class ZTTeamTemplatesController {

  constructor(
    private readonly templatesService: ZTTeamTemplatesService,
    private readonly ttsService: ZTTeamTTSService,
  ) {}

  @Get()
  ztteam_getTemplates(@Query('format') format?: string, @Query('pageId') pageId?: string) {
    return this.templatesService.ztteam_getTemplates(format, pageId);
  }

  @Get(':id')
  ztteam_getTemplate(@Param('id') id: string) {
    return this.templatesService.ztteam_getTemplate(id);
  }

  @Post()
  ztteam_createTemplate(@Body() body: any) {
    return this.templatesService.ztteam_createTemplate(body);
  }

  @Post('clone')
  ztteam_cloneTemplate(@Body() body: { templateId: string; pageId: string }) {
    return this.templatesService.ztteam_cloneTemplate(body.templateId, body.pageId);
  }

  /** @UseGuards(JwtAuthGuard) */
  @Put(':id')
  ztteam_updateTemplate(@Param('id') id: string, @Body() body: any) {
    return this.templatesService.ztteam_updateTemplate(id, body);
  }

  @Delete(':id')
  ztteam_deleteTemplate(@Param('id') id: string) {
    return this.templatesService.ztteam_deleteTemplate(id);
  }

  @Post(':id/duplicate')
  ztteam_duplicateTemplate(@Param('id') id: string) {
    return this.templatesService.ztteam_duplicateTemplate(id);
  }

  @Post([':id/bg', ':id/upload-bg', 'upload-bg'])
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req: any, file: any, cb: any) => {
        const templatesPath = ztteam_getTemplatesPath();
        cb(null, templatesPath);
      },
      filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    })
  }))
  async ztteam_uploadBg(@Param('id') id: string, @UploadedFile() file: any) {
    const url = `/storage/templates/${file.filename}`;
    return { url };
  }

  @Post('tts/test')
  async ztteam_testVoice(@Body() body: { voice: string, text: string }) {
    try {
      const tempDir = path.join(os.tmpdir(), `test_tts_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      const audioPath = await this.ttsService.ztteam_textToSpeech(
        body.text || 'Đây là bản nghe thử giọng đọc của hệ thống.',
        body.voice || 'Phạm Tuyên',
        tempDir,
      );
      const buffer = fs.readFileSync(audioPath);
      const base64 = buffer.toString('base64');
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { url: `data:audio/mp3;base64,${base64}` };
    } catch (e: any) {
      throw new HttpException(
        e.message || 'Lỗi tạo giọng đọc',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
