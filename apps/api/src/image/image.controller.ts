import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, Sse, MessageEvent, Header, Delete, Request } from '@nestjs/common';
import { ZTTeamAuthGuard } from '../auth/auth.guard';
import { ZTTeamImageProcessor } from './image.processor';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable, fromEvent } from 'rxjs';
import { map } from 'rxjs/operators';
import { ZTTeamFacebookService } from '../facebook/facebook.service';
import * as fs from 'fs';
import * as path from 'path';
import { ztteam_getImagesPath, ztteam_getStorageRoot } from '../common/ztteam_storage.util';

@Controller('image')
export class ZTTeamImageController {
  constructor(
    private readonly imageProcessor: ZTTeamImageProcessor,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly facebookService: ZTTeamFacebookService,
  ) {}

  @Sse('events')
  @Header('Cache-Control', 'no-cache')
  @Header('X-Accel-Buffering', 'no')
  ztteam_imageEvents(): Observable<MessageEvent> {
    return fromEvent(this.eventEmitter, 'image.updated').pipe(
      map((payload) => {
        return { data: payload } as MessageEvent;
      }),
    );
  }

  @Post('create')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_createImageJob(
    @Body() body: { pageId: string; wpPostId: string; wpPostTitle: string; wpPostUrl?: string; templateId: string },
  ) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: body.pageId }
    });

    if (!page) {
      throw new Error(`Page ${body.pageId} not found in system`);
    }

    const image = await this.prisma.ztteam_images.create({
      data: {
        page_id: page.id,
        wp_post_id: body.wpPostId,
        wp_post_title: body.wpPostTitle,
        wp_post_url: body.wpPostUrl,
        template_id: body.templateId,
      },
    });

    await this.prisma.ztteam_image_history.upsert({
      where: { page_id_wp_post_id: { page_id: page.id, wp_post_id: body.wpPostId } },
      create: { page_id: page.id, wp_post_id: body.wpPostId },
      update: {},
    });

    const jobId = await this.imageProcessor.ztteam_addJob({
      imageId: image.id,
      pageId: page.id,
      wpPostId: body.wpPostId,
      templateId: body.templateId,
    });

    return { success: true, imageId: image.id, jobId };
  }

  @Post('test-render')
  async ztteam_testRender(@Body() body: { templateId: string, title: string, images: string[] }) {
    const url = await this.imageProcessor.ztteam_testRender(body.templateId, body.title, body.images);
    return { success: true, url };
  }

  @Get('list')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_listImages(
    @Request() req: any,
    @Query('fbPageId') fbPageId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    let where: any = {};
    if (fbPageId) {
      const p = await this.prisma.ztteam_pages.findFirst({
        where: { fb_page_id: fbPageId }
      });
      if (!p) {
        return { data: [], total: 0 };
      }
      where.page_id = p.id;
    }

    /** Lọc dữ liệu theo User đang đăng nhập */
    where.page = {
      ...where.page,
      fb_account: {
        owner_user_id: req.user.sub
      }
    };
    
    const [images, total] = await Promise.all([
      this.prisma.ztteam_images.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(limit),
        include: { page: true }
      }),
      this.prisma.ztteam_images.count({
        where,
      }),
    ]);

    const pageIds = [...new Set(images.map(r => r.page_id))];
    const lastPostedImages = await this.prisma.ztteam_images.findMany({
      where: { page_id: { in: pageIds }, is_posted: true },
      orderBy: { posted_at: 'desc' },
      distinct: ['page_id']
    });
    const lastPostedReels = await this.prisma.ztteam_reels.findMany({
      where: { page_id: { in: pageIds }, status: 'POSTED' },
      orderBy: { updated_at: 'desc' },
      distinct: ['page_id']
    });

    const lastPostedMap = new Map<string, Date>();
    for (const img of lastPostedImages) {
      if (img.posted_at) lastPostedMap.set(img.page_id, img.posted_at);
    }
    for (const r of lastPostedReels) {
      const existing = lastPostedMap.get(r.page_id);
      if (!existing || r.updated_at > existing) {
        lastPostedMap.set(r.page_id, r.updated_at);
      }
    }
    
    /** Simulate queue to get precise scheduled times for all pending images */
    const allPending = await this.prisma.ztteam_images.findMany({
       where: { status: { in: ['QUEUED', 'RENDERING', 'COMPLETED'] }, is_posted: false },
       orderBy: { created_at: 'asc' },
       include: { page: true }
    });
    
    const pageNextTimeMap = new Map<string, Date | null>();
    const imageScheduledTimeMap = new Map<string, Date | null>();
    const ztteam_now = new Date();

    for (const pending of allPending) {
       const pageId = pending.page_id;
       const p = pending.page as any;
       if (!p) continue;

       let baseTime = pageNextTimeMap.get(pageId);
       if (!baseTime) {
         const lastPost = lastPostedMap.get(pageId);
         /** ZTTeam: Nếu bài đăng gần nhất đã ở quá khứ hoặc chưa có, mốc tính bắt buộc phải từ thời điểm hiện tại trở đi */
         baseTime = (lastPost && lastPost.getTime() > ztteam_now.getTime()) ? lastPost : ztteam_now;
       } else if (baseTime.getTime() < ztteam_now.getTime()) {
         baseTime = ztteam_now;
       }

       let scheduledAt: Date | null = null;

       if (p.auto_publish_enabled === false) {
         scheduledAt = null;
       } else if (p.schedule_mode === 'fixed') {
         const times = (p.schedule_fixed_times || []).slice();
         if (times.length > 0) {
           times.sort();
           let found = false;

           /** ZTTeam: Lấy ngày, tháng, năm của baseTime theo múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh - UTC+7) */
           const vnBaseDateParts = new Intl.DateTimeFormat('en-US', {
             timeZone: 'Asia/Ho_Chi_Minh',
             year: 'numeric',
             month: 'numeric',
             day: 'numeric',
           }).formatToParts(baseTime);

           const vnYear = parseInt(vnBaseDateParts.find(pt => pt.type === 'year')?.value || '2026', 10);
           const vnMonth = parseInt(vnBaseDateParts.find(pt => pt.type === 'month')?.value || '1', 10) - 1;
           const vnDay = parseInt(vnBaseDateParts.find(pt => pt.type === 'day')?.value || '1', 10);

           for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
             for (const time of times) {
               const [h, m] = time.split(':').map(Number);
               /** ZTTeam: Múi giờ Việt Nam là UTC+7, nên giờ UTC = h - 7 */
               const utcTimestamp = Date.UTC(vnYear, vnMonth, vnDay + dayOffset, h - 7, m, 0, 0);
               const testDate = new Date(utcTimestamp);

               if (testDate.getTime() > baseTime.getTime() && testDate.getTime() > ztteam_now.getTime()) {
                 scheduledAt = testDate;
                 found = true;
                 break;
               }
             }
             if (found) break;
           }
         } else {
           scheduledAt = null;
         }
       } else if (p.schedule_mode === 'immediate') {
         const gap = p.schedule_immediate_gap_minutes || 0;
         const diff = gap * 60000;
         const candidate = new Date(baseTime.getTime() + diff);
         scheduledAt = candidate.getTime() > ztteam_now.getTime() ? candidate : ztteam_now;
       } else {
         scheduledAt = null;
       }

       imageScheduledTimeMap.set(pending.id, scheduledAt);
       if (scheduledAt) {
         pageNextTimeMap.set(pageId, scheduledAt);
       }
    }

    const imagesWithDetails = images.map(r => {
      let posted_at = null;
      let scheduled_at = null;

      if (r.is_posted) {
        posted_at = r.posted_at || r.updated_at;
      } else {
        scheduled_at = imageScheduledTimeMap.get(r.id) || null;
      }

      return {
        ...r,
        posted_at,
        scheduled_at
      };
    });

    return { data: imagesWithDetails, total };
  }

  @Post(':id/post-to-fb')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_postToFb(@Param('id') id: string) {
    const image = await this.prisma.ztteam_images.findUnique({
      where: { id },
      include: { page: true }
    });
    if (!image) throw new Error('Image not found');

    if (!image.image_url) throw new Error('Image output not available');

    let absoluteImagePath = ztteam_getImagesPath(image.id, 'output.png');

    if (!fs.existsSync(absoluteImagePath) && image.image_url) {
      let fallback: string;
      if (image.image_url.startsWith('/storage') || image.image_url.startsWith('storage')) {
        fallback = path.join(ztteam_getStorageRoot(), image.image_url.replace(/^\/?storage[/\\]?/, ''));
      } else if (fs.existsSync(image.image_url)) {
        fallback = image.image_url;
      } else {
        fallback = path.join(ztteam_getStorageRoot(), image.image_url.replace(/^[/\\]+/, ''));
      }
      if (fs.existsSync(fallback)) {
        absoluteImagePath = fallback;
      }
    }

    if (!fs.existsSync(absoluteImagePath)) {
      throw new Error('Image file not found on disk');
    }

    let description = image.ai_caption || image.wp_post_title || '';
    let trackingLinkManual = '';
    
    if (image.wp_post_url) {
      const slugify = (text: string) => {
        if (!text) return '';
        return text.toString().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').replace(/\-\-+/g, '-').trim();
      };
      const pageData = await this.prisma.ztteam_pages.findUnique({
        where: { id: image.page_id },
        include: { fb_account: true }
      });
      const utmMedium = slugify(pageData?.fb_account?.name || 'account');
      const utmCampaign = slugify(pageData?.name || 'page');
      trackingLinkManual = `${image.wp_post_url}${image.wp_post_url.includes('?') ? '&' : '?'}utm_source=image&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
      
      if (image.page.add_link_to_caption) {
        const prefixes = [
          '👉 Discover more here:',
          '🔥 Read the full story:',
          '📌 Check out the details:',
          '👇 Full article link:',
          '🔗 Learn more at:'
        ];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        description = `${prefix} ${trackingLinkManual}\n\n${description}`;
      }
    }

    const fbPostId = await this.facebookService.ztteam_publishPhoto(
      image.page.fb_page_id,
      absoluteImagePath,
      description
    );

    /** Quy trinh comment tu dong se duoc publisher.cron xu ly: sau 1 gio dang comment moi va sau 15 phut reply Part 2 + link */
    const updatedImage = await this.prisma.ztteam_images.update({
      where: { id },
      data: {
        is_posted: true,
        posted_at: new Date(),
        fb_post_id: fbPostId,
        status: 'POSTED',
        comment_step: 0,
      }
    });

    this.eventEmitter.emit('image.updated', updatedImage);

    return { success: true, fbPostId };
  }

  @Post(':id/test-render-queue')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_testRenderQueue(@Param('id') id: string) {
    try {
      const imageUrl = await this.imageProcessor.ztteam_testRenderQueueItem(id);
      return { success: true, imageUrl };
    } catch (error: any) {
      throw new Error(error.message || 'Lỗi tạo ảnh test');
    }
  }

  @Put(':id/save-caption')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_saveImageCaption(
    @Param('id') id: string,
    @Body() body: { caption?: string; firstComment?: string }
  ) {
    const updated = await this.prisma.ztteam_images.update({
      where: { id },
      data: {
        ai_caption: body.caption,
        ai_first_comment: body.firstComment
      }
    });
    this.eventEmitter.emit('image.updated', updated);
    return { success: true };
  }

  @Post('retry/:id')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_retryImage(@Param('id') id: string) {
    const image = await this.prisma.ztteam_images.findUnique({ where: { id } });
    if (!image) throw new Error('Image not found');

    await this.prisma.ztteam_images.update({
      where: { id },
      data: { status: 'QUEUED', error_log: null, post_retry_count: 0 }
    });

    const jobId = await this.imageProcessor.ztteam_addJob({
      imageId: image.id,
      pageId: image.page_id,
      wpPostId: image.wp_post_id,
      templateId: image.template_id,
    });

    return { success: true, jobId };
  }

  @Delete(':id')
  @UseGuards(ZTTeamAuthGuard)
  async ztteam_deleteImage(@Param('id') id: string) {
    const image = await this.prisma.ztteam_images.findUnique({ where: { id } });
    if (!image) return { success: true };

    const workDir = ztteam_getImagesPath(image.id);
    if (fs.existsSync(workDir)) {
      fs.rmSync(workDir, { recursive: true, force: true });
    }

    await this.prisma.ztteam_images.delete({ where: { id } });
    return { success: true };
  }
}
