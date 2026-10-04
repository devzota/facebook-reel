import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ZTTeamFacebookService {
  private readonly logger = new Logger(ZTTeamFacebookService.name);
  private readonly API_VERSION = 'v25.0';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) { }

  async ztteam_exchangeLongLivedToken(shortToken: string, userId: string) {
    /** In a real scenario, appId and appSecret should come from DB or .env */
    const appId = process.env.FB_APP_ID || '';
    const appSecret = process.env.FB_APP_SECRET || '';

    try {
      const response = await firstValueFrom(
        this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/oauth/access_token`, {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortToken,
          }
        })
      );

      const longLivedToken = response.data.access_token;

      /** Get FB user id */
      const meResponse = await firstValueFrom(
        this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/me`, {
          params: { access_token: longLivedToken }
        })
      );

      const fbUserId = meResponse.data.id;
      const fbName = meResponse.data.name;

      /** Kiểm tra nếu tài khoản FB này đã được kết nối bởi một user khác */
      const existingOtherUser = await this.prisma.ztteam_fb_accounts.findFirst({
        where: { fb_user_id: fbUserId, owner_user_id: { not: userId } }
      });
      if (existingOtherUser) {
        /** Kiểm tra xem tài khoản FB cũ này có còn Fanpage nào đang tồn tại không */
        const activePagesCount = await this.prisma.ztteam_pages.count({
          where: { fb_account_id: existingOtherUser.id }
        });
        if (activePagesCount > 0) {
          throw new BadRequestException('Tài khoản Facebook này đã được kết nối bởi người quản trị khác. Vui lòng sử dụng tài khoản Facebook của riêng bạn!');
        } else {
          /** Nếu tài khoản FB cũ đã bị xóa hết Page ➔ Tự động chuyển quyền sở hữu sang userId hiện tại */
          await this.prisma.ztteam_fb_accounts.update({
            where: { id: existingOtherUser.id },
            data: { owner_user_id: userId, user_token_encrypted: longLivedToken, name: fbName }
          });
        }
      }

      /** Upsert FB account in DB */
      let fbAccount = await this.prisma.ztteam_fb_accounts.findFirst({
        where: { fb_user_id: fbUserId, owner_user_id: userId }
      });

      if (fbAccount) {
        fbAccount = await this.prisma.ztteam_fb_accounts.update({
          where: { id: fbAccount.id },
          data: { user_token_encrypted: longLivedToken, name: fbName }
        });
      } else {
        fbAccount = await this.prisma.ztteam_fb_accounts.create({
          data: {
            fb_user_id: fbUserId,
            name: fbName,
            user_token_encrypted: longLivedToken,
            owner_user_id: userId,
          }
        });
      }

      return fbAccount;
    } catch (error) {
      this.logger.error('Error exchanging Facebook token', error);
      throw error;
    }
  }

  async ztteam_fetchPages(fbAccountId: string, userId: string) {
    const fbAccount = await this.prisma.ztteam_fb_accounts.findFirst({
      where: { fb_user_id: fbAccountId, owner_user_id: userId }
    });

    if (!fbAccount) {
      throw new BadRequestException('Không tìm thấy tài khoản Facebook hoặc bạn không có quyền!');
    }

    try {
      /** GET /me/accounts with user long lived token gives page access tokens that do not expire */
      const response = await firstValueFrom(
        this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/me/accounts`, {
          params: {
            access_token: fbAccount.user_token_encrypted,
            fields: 'id,name,picture.type(large),category,followers_count,fan_count,access_token',
            limit: 100
          }
        })
      );

      const pages = response.data.data;

      /**
       * CHỈ update các trường lấy từ Facebook API (name, avatar, category, token, follower_count).
       * KHÔNG BAO GIỜ ghi đè: default_reel_template_id, auto_create_enabled, schedule_*,
       * ai_tone, ai_caption_length, ai_custom_prompt, voice_speed, tags, sources, v.v.
       */
      for (const page of pages) {
        const pageData: any = {
          name: page.name,
          category: page.category || null,
          page_token_encrypted: page.access_token,
          token_status: 'active',
        };
        
        if (page.id) {
          pageData.avatar = `https://graph.facebook.com/${page.id}/picture?type=large`;
        }

        const newCount = page.followers_count ?? page.fan_count;
        if (newCount !== undefined) {
          pageData.follower_count = newCount;
        }

        const existingPage = await this.prisma.ztteam_pages.findFirst({
          where: {
            fb_page_id: page.id,
          },
          include: {
            fb_account: true
          }
        });

        if (existingPage) {
          /** Nếu Fanpage đã tồn tại và thuộc về tài khoản FB này thì update token */
          if (existingPage.fb_account_id === fbAccount.id) {
            await this.prisma.ztteam_pages.update({
              where: { id: existingPage.id },
              data: pageData,
            });
          } 
          /** Nếu Fanpage thuộc về tài khoản FB khác nhưng CÙNG 1 người dùng Web -> Chuyển giao quyền sở hữu (Nick cũ bị lỗi) */
          else if (existingPage.fb_account?.owner_user_id === fbAccount.owner_user_id) {
            await this.prisma.ztteam_pages.update({
              where: { id: existingPage.id },
              data: {
                ...pageData,
                fb_account_id: fbAccount.id,
              },
            });
            this.logger.log(`Transferred page ${page.name} to new FB account ${fbAccount.name} for user ${fbAccount.owner_user_id}`);
          }
          /** Nếu thuộc về User khác hoàn toàn, ta bỏ qua không tạo mới để tránh trùng lặp. */
        } else {
          await this.prisma.ztteam_pages.create({
            data: {
              ...pageData,
              fb_page_id: page.id,
              fb_account_id: fbAccount.id,
            },
          });
        }
      }

      return this.ztteam_getConnectedPages(fbAccount.owner_user_id);
    } catch (error) {
      this.logger.error('Error fetching Facebook pages', error);
      throw error;
    }
  }

  private async ztteam_computePageTimesAndNextVideo(page: any) {
    let lastRenderTime = page.last_auto_scan_at ? page.last_auto_scan_at : null;
    let nextRenderTime = null;
    if (page.auto_create_enabled) {
      if (lastRenderTime) {
        nextRenderTime = new Date(new Date(lastRenderTime).getTime() + page.auto_scan_interval_hours * 3600000);
      } else {
        nextRenderTime = new Date();
      }
    }

    const lastPublishedReel = await this.prisma.ztteam_reels.findFirst({
      where: { page_id: page.id, status: 'POSTED' },
      orderBy: { updated_at: 'desc' }
    });
    
    const lastPublishedImage = await this.prisma.ztteam_images.findFirst({
      where: { page_id: page.id, is_posted: true },
      orderBy: { posted_at: 'desc' }
    });

    let lastPublishTime = lastPublishedReel ? lastPublishedReel.updated_at : null;
    if (lastPublishedImage?.posted_at && (!lastPublishTime || lastPublishedImage.posted_at > lastPublishTime)) {
      lastPublishTime = lastPublishedImage.posted_at;
    }
    
    let nextPublishTime = null;

    if (page.auto_publish_enabled === false) {
      nextPublishTime = null;
    } else if (page.schedule_mode === 'immediate') {
      const ztteam_now = new Date();
      if (lastPublishTime) {
        const candidate = new Date(new Date(lastPublishTime).getTime() + page.schedule_immediate_gap_minutes * 60000);
        nextPublishTime = candidate.getTime() > ztteam_now.getTime() ? candidate : ztteam_now;
      } else {
        nextPublishTime = ztteam_now;
      }
    } else if (page.schedule_mode === 'fixed' && page.schedule_fixed_times.length > 0) {
      const ztteam_now = new Date();
      /** ZTTeam: Lấy giờ, phút, ngày theo múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh - UTC+7) */
      const ztteam_vnFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const ztteam_parts = ztteam_vnFormatter.formatToParts(ztteam_now);
      const ztteam_vnH = parseInt(ztteam_parts.find(p => p.type === 'hour')?.value || '0', 10);
      const ztteam_vnM = parseInt(ztteam_parts.find(p => p.type === 'minute')?.value || '0', 10);
      const ztteam_vnYear = parseInt(ztteam_parts.find(p => p.type === 'year')?.value || '2026', 10);
      const ztteam_vnMonth = parseInt(ztteam_parts.find(p => p.type === 'month')?.value || '1', 10) - 1;
      const ztteam_vnDay = parseInt(ztteam_parts.find(p => p.type === 'day')?.value || '1', 10);

      const ztteam_currentMinutes = ztteam_vnH * 60 + ztteam_vnM;
      const ztteam_sortedTimes = [...page.schedule_fixed_times].sort();
      let ztteam_foundTime: Date | null = null;

      /** ZTTeam: Tìm khung giờ tiếp theo còn lại trong ngày hôm nay */
      for (const t of ztteam_sortedTimes) {
        const [h, m] = t.split(':').map(Number);
        const tMinutes = h * 60 + m;
        if (tMinutes > ztteam_currentMinutes) {
          ztteam_foundTime = new Date(Date.UTC(ztteam_vnYear, ztteam_vnMonth, ztteam_vnDay, h - 7, m, 0, 0));
          break;
        }
      }

      /** ZTTeam: Nếu tất cả khung giờ hôm nay đã qua, lấy khung giờ đầu tiên của ngày mai */
      if (!ztteam_foundTime && ztteam_sortedTimes.length > 0) {
        const [h, m] = ztteam_sortedTimes[0].split(':').map(Number);
        ztteam_foundTime = new Date(Date.UTC(ztteam_vnYear, ztteam_vnMonth, ztteam_vnDay + 1, h - 7, m, 0, 0));
      }

      nextPublishTime = ztteam_foundTime;
    }

    const nextReelToPublish = await this.prisma.ztteam_reels.findFirst({
      where: { page_id: page.id, status: 'COMPLETED', is_posted: false },
      orderBy: { created_at: 'asc' }
    });

    let templateName = null;
    if (page.default_reel_template_id) {
      const tpl = await this.prisma.ztteam_templates.findUnique({
        where: { id: page.default_reel_template_id },
        select: { name: true }
      });
      templateName = tpl ? tpl.name : null;
    }

    return {
      lastRenderTime,
      nextRenderTime,
      lastPublishTime,
      nextPublishTime,
      nextVideoTitle: nextReelToPublish ? (nextReelToPublish.wp_post_title || 'Video AI') : null,
      templateName
    };
  }

  async ztteam_getConnectedPages(userId: string) {
    const fbAccounts = await this.prisma.ztteam_fb_accounts.findMany({
      where: { owner_user_id: userId },
      select: { id: true }
    });

    if (fbAccounts.length === 0) return [];

    const accountIds = fbAccounts.map(a => a.id);

    const pages = await this.prisma.ztteam_pages.findMany({
      where: { fb_account_id: { in: accountIds } },
      include: { fb_account: true, sources: true, youtube_settings: true },
      orderBy: { name: 'asc' }
    });

    const result = await Promise.all(pages.map(async p => {
      const times = await this.ztteam_computePageTimesAndNextVideo(p);
      return {
        id: p.fb_page_id,
        name: p.name,
        category: p.category,
        followersCount: p.follower_count,
        avatar: p.avatar,
        ownerName: p.fb_account.name,
        status: p.token_status,
        isActive: p.is_active,
        tags: p.tags,
        postFormat: p.post_format,
        scheduleMode: p.schedule_mode,
        autoPublishEnabled: p.auto_publish_enabled,
        autoCreateEnabled: p.auto_create_enabled,
        nextPublishTime: times.nextPublishTime,
        nextRenderTime: times.nextRenderTime,
        scheduleFixedTimes: p.schedule_fixed_times,
        scheduleImmediateGapMinutes: p.schedule_immediate_gap_minutes,
        autoScanIntervalHours: p.auto_scan_interval_hours,
        defaultReelTemplateId: p.default_reel_template_id,
        defaultReelTemplateName: times.templateName,
        nextVideoTitle: times.nextVideoTitle
        /** We do not send accessToken back to frontend for security */
      };
    }));
    return result;
  }


  async ztteam_getPageSettings(pageId: string, userId: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: {
        OR: [
          { fb_page_id: pageId },
          { id: pageId }
        ]
      },
      include: {
        fb_account: true,
        sources: true,
        youtube_settings: true
      }
    });

    if (!page || page.fb_account.owner_user_id !== userId) {
      throw new Error('Fanpage không tồn tại hoặc bạn không có quyền');
    }

    const times = await this.ztteam_computePageTimesAndNextVideo(page);

    return {
      id: page.id,
      fb_page_id: page.fb_page_id,
      name: page.name,
      avatar: page.avatar,
      tags: page.tags,
      post_format: page.post_format,
      auto_publish_enabled: page.auto_publish_enabled,
      add_link_to_caption: page.add_link_to_caption,
      add_link_to_comment: page.add_link_to_comment,
      schedule_mode: page.schedule_mode,
      schedule_fixed_times: page.schedule_fixed_times,
      schedule_immediate_gap_minutes: page.schedule_immediate_gap_minutes,
      default_reel_template_id: page.default_reel_template_id,
      default_image_template_id: page.default_image_template_id,
      auto_create_enabled: page.auto_create_enabled,
      auto_scan_interval_hours: page.auto_scan_interval_hours,
      auto_scan_batch_size: page.auto_scan_batch_size,
      auto_queue_limit: page.auto_queue_limit,
      auto_max_post_age_days: page.auto_max_post_age_days,
      ai_tone: page.ai_tone,
      ai_caption_length: page.ai_caption_length,
      ai_custom_prompt: page.ai_custom_prompt,
      voice_speed: page.voice_speed,
      last_render_time: times.lastRenderTime,
      next_render_time: times.nextRenderTime,
      last_publish_time: times.lastPublishTime,
      next_publish_time: times.nextPublishTime,
      next_video_title: times.nextVideoTitle,
      sources: page.sources.map(s => ({
        id: s.id,
        target_site_id: s.target_site_id,
        target_category_id: s.target_category_id,
        target_tags: s.target_tags,
        is_active: s.is_active
      })),
      youtube_settings: page.youtube_settings ? {
        source_id: page.youtube_settings.source_id,
        is_active: page.youtube_settings.is_active,
        add_watermark: page.youtube_settings.add_watermark,
        watermark_text: page.youtube_settings.watermark_text,
        add_frame: page.youtube_settings.add_frame
      } : null
    };
  }

  async ztteam_updatePageSettings(pageId: string, userId: string, config: any) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: {
        OR: [
          { fb_page_id: pageId },
          { id: pageId }
        ]
      },
      include: { fb_account: true }
    });

    if (!page || page.fb_account.owner_user_id !== userId) {
      throw new Error('Fanpage không tồn tại hoặc bạn không có quyền');
    }

    /** Kiểm tra trùng lặp giờ đăng cố định giữa các Fanpage */
    if (config.schedule_mode === 'fixed' && config.schedule_fixed_times && config.schedule_fixed_times.length > 0) {
      const otherPages = await this.prisma.ztteam_pages.findMany({
        where: {
          id: { not: page.id },
          fb_account: { owner_user_id: userId },
          schedule_mode: 'fixed'
        }
      });
      
      const usedTimes = new Set();
      for (const p of otherPages) {
        if (p.schedule_fixed_times && Array.isArray(p.schedule_fixed_times)) {
          for (const time of p.schedule_fixed_times) {
            usedTimes.add(time);
          }
        }
      }
      
      for (const time of config.schedule_fixed_times) {
        if (usedTimes.has(time)) {
          throw new BadRequestException(`Giờ đăng ${time} đã được sử dụng ở một Fanpage khác. Vui lòng chọn khung giờ khác để tránh trùng lặp!`);
        }
      }
    }

    /** Update main page fields */
    await this.prisma.ztteam_pages.update({
      where: { id: page.id },
      data: {
        tags: config.tags,
        post_format: config.post_format,
        auto_publish_enabled: config.auto_publish_enabled !== undefined ? config.auto_publish_enabled : true,
        add_link_to_caption: config.add_link_to_caption,
        add_link_to_comment: config.add_link_to_comment,
        schedule_mode: config.schedule_mode,
        schedule_fixed_times: config.schedule_fixed_times,
        schedule_immediate_gap_minutes: config.schedule_immediate_gap_minutes,
        default_reel_template_id: config.default_reel_template_id,
        default_image_template_id: config.default_image_template_id,
        auto_create_enabled: config.auto_create_enabled,
        auto_scan_interval_hours: config.auto_scan_interval_hours,
        auto_scan_batch_size: config.auto_scan_batch_size,
        auto_queue_limit: config.auto_queue_limit,
        auto_max_post_age_days: config.auto_max_post_age_days,
        ai_tone: config.ai_tone,
        ai_caption_length: config.ai_caption_length,
        ai_custom_prompt: config.ai_custom_prompt,
        voice_speed: config.voice_speed,
      }
    });

    /** Handle sources */
    if (config.sources && Array.isArray(config.sources)) {
      /** Delete old sources */
      await this.prisma.ztteam_page_sources.deleteMany({
        where: { page_id: page.id }
      });
      /** Add new sources */
      if (config.sources.length > 0) {
        await this.prisma.ztteam_page_sources.createMany({
          data: config.sources.map((s: any) => ({
            page_id: page.id,
            target_site_id: s.target_site_id,
            target_category_id: s.target_category_id !== null && s.target_category_id !== undefined ? String(s.target_category_id) : null,
            target_tags: s.target_tags !== null && s.target_tags !== undefined ? String(s.target_tags) : null,
            is_active: s.is_active !== undefined ? Boolean(s.is_active) : true
          }))
        });
      }
    }

    /** Handle youtube_settings */
    if (config.youtube_settings) {
      await this.prisma.ztteam_page_youtube_settings.deleteMany({
        where: { page_id: page.id }
      });
      if (config.youtube_settings.source_id) {
        await this.prisma.ztteam_page_youtube_settings.create({
          data: {
            page_id: page.id,
            source_id: config.youtube_settings.source_id,
            is_active: config.youtube_settings.is_active !== undefined ? config.youtube_settings.is_active : true,
            add_watermark: config.youtube_settings.add_watermark || false,
            watermark_text: config.youtube_settings.watermark_text || null,
            add_frame: config.youtube_settings.add_frame || false
          }
        });
      }
    }

    return { success: true };
  }


  async ztteam_testPost(pageId: string, userId: string, message: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId },
      include: { fb_account: true }
    });

    if (!page) {
      throw new Error('Fanpage không tồn tại trong hệ thống');
    }
    if (page.fb_account.owner_user_id !== userId) {
      throw new Error('Bạn không có quyền thao tác trên Fanpage này');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/${this.API_VERSION}/${pageId}/feed`,
          { message },
          { params: { access_token: page.page_token_encrypted } }
        )
      );

      return { success: true, postId: response.data.id };
    } catch (error: any) {
      this.logger.error('Error posting to Facebook', error.response?.data || error);
      throw new Error(error.response?.data?.error?.message || 'Lỗi kết nối đến Facebook API');
    }
  }

  async ztteam_getPageInsights(pageId: string, userId?: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { OR: [{ id: pageId }, { fb_page_id: pageId }] },
      include: { fb_account: true }
    });

    if (!page) {
      throw new Error('Fanpage không tồn tại');
    }

    const realFbPageId = page.fb_page_id;

    try {
      const metrics = ['page_media_view', 'page_total_media_view_unique', 'page_views_total', 'page_post_engagements', 'page_daily_follows', 'page_fans'];
      const results = [];

      for (const metric of metrics) {
        try {
          const res = await firstValueFrom(
            this.httpService.get(
              `https://graph.facebook.com/${this.API_VERSION}/${realFbPageId}/insights`,
              {
                params: { metric, period: 'day', date_preset: 'last_28d', access_token: page.page_token_encrypted }
              }
            )
          );
          if (res.data?.data?.length > 0) {
            results.push(res.data.data[0]);
          }
        } catch (e: any) {
          this.logger.warn(`Failed metric ${metric}:`, e.response?.data?.error?.message);
        }
      }

      return results;
    } catch (error: any) {
      this.logger.warn('Error fetching Facebook insights, returning empty data.', error.response?.data || error.message);
      /** Fallback: return mock/empty data so frontend doesn't break */
      return [];
    }
  }

  async ztteam_getTopPosts(pageId: string, userId: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { OR: [{ id: pageId }, { fb_page_id: pageId }] },
      include: { fb_account: true }
    });

    if (!page || page.fb_account.owner_user_id !== userId) {
      throw new Error('Fanpage không tồn tại hoặc bạn không có quyền');
    }

    const realFbPageId = page.fb_page_id;

    try {
      let response;
      try {
        response = await firstValueFrom(
          this.httpService.get(
            `https://graph.facebook.com/${this.API_VERSION}/${realFbPageId}/published_posts`,
            {
              params: {
                fields: 'id,message,created_time,full_picture,reactions.summary(true),comments.summary(true),shares',
                limit: 50,
                access_token: page.page_token_encrypted
              }
            }
          )
        );
      } catch (fallbackErr: any) {
        this.logger.warn(`Fallback fetching top posts without engagement:`, fallbackErr.response?.data?.error?.message);
        response = await firstValueFrom(
          this.httpService.get(
            `https://graph.facebook.com/${this.API_VERSION}/${realFbPageId}/published_posts`,
            {
              params: {
                fields: 'id,message,created_time,full_picture',
                limit: 50,
                access_token: page.page_token_encrypted
              }
            }
          )
        );
      }

      /** Lấy danh sách videos từ Facebook để có con số lượt xem (video views) chuẩn xác */
      let videoViewsMap: Record<string, number> = {};
      try {
        const videoRes = await firstValueFrom(
          this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/${realFbPageId}/videos`, {
            params: {
              fields: 'id,views',
              limit: 25,
              access_token: page.page_token_encrypted
            }
          })
        );
        if (videoRes.data?.data) {
          for (const v of videoRes.data.data) {
            if (v.id) videoViewsMap[v.id] = v.views || 0;
          }
        }
      } catch (e: any) {
        /** Ignore video fetch error */
      }

      /** Lấy post_clicks song song cho từng bài để xử lý siêu tốc */
      const rawPosts = (response.data?.data || []).slice(0, 25);
      const posts = await Promise.all(rawPosts.map(async (post: any) => {
        let reactionsCount = post.reactions?.summary?.total_count || 0;
        let commentsCount = post.comments?.summary?.total_count || 0;
        let sharesCount = post.shares?.count || 0;

        let clicks = 0;
        let photoViews = 0;
        let mediaViews = 0;
        let mediaViewsUnique = 0;
        let insightsVideoViews = 0;

        try {
          const insightRes = await firstValueFrom(
            this.httpService.get(
              `https://graph.facebook.com/${this.API_VERSION}/${post.id}/insights`,
              {
                params: {
                  metric: 'post_media_view,post_total_media_view_unique,post_video_views,post_clicks,post_clicks_by_type,post_activity_by_action_type',
                  access_token: page.page_token_encrypted
                }
              }
            )
          );
          const data = insightRes.data?.data || [];
          for (const item of data) {
            if (item.name === 'post_clicks') {
              clicks = Math.max(clicks, item.values?.[0]?.value || 0);
            }
            if (item.name === 'post_clicks_by_type') {
              const types = item.values?.[0]?.value || {};
              photoViews = Math.max(photoViews, types['photo view'] || 0);
            }
            if (item.name === 'post_media_view') {
              mediaViews = Math.max(mediaViews, item.values?.[0]?.value || 0);
            }
            if (item.name === 'post_total_media_view_unique') {
              mediaViewsUnique = Math.max(mediaViewsUnique, item.values?.[0]?.value || 0);
            }
            if (item.name === 'post_video_views') {
              insightsVideoViews = Math.max(insightsVideoViews, item.values?.[0]?.value || 0);
            }
            if (item.name === 'post_activity_by_action_type') {
              const types = item.values?.[0]?.value || {};
              if (reactionsCount === 0 && types['like']) reactionsCount = types['like'];
              if (commentsCount === 0 && types['comment']) commentsCount = types['comment'];
              if (sharesCount === 0 && types['share']) sharesCount = types['share'];
            }
          }
        } catch (e: any) {
          /** Ignore insight error */
        }

        /** Lượt xem video/reel chuẩn từ node video */
        let videoViews = 0;
        for (const vId in videoViewsMap) {
          if (post.id && post.id.includes(vId)) {
            videoViews = videoViewsMap[vId];
            break;
          }
        }

        /** Tổng tương tác chuẩn Meta DOC: Cảm xúc + Lượt nhấp + Bình luận + Chia sẻ */
        const engagements = reactionsCount + clicks + commentsCount + sharesCount;

        /** Lượt xem (Impressions): Sử dụng post_media_view (nếu có), nếu video thì kết hợp videoViews */
        let views = mediaViews > 0 ? mediaViews : (videoViews > 0 ? videoViews : (insightsVideoViews > 0 ? insightsVideoViews : (photoViews > 0 ? photoViews : clicks)));

        /** Người xem (Reach): Sử dụng post_total_media_view_unique (nếu có) */
        let reach = mediaViewsUnique > 0 ? mediaViewsUnique : views;

        /** Lượt hiển thị (Impressions): Bằng số views đối với API hiện tại */
        let impressions = views;

        /** Đảm bảo không bao giờ bị 0 nếu bài viết có tương tác */
        if (views === 0 && engagements > 0) views = engagements;
        if (reach === 0 && engagements > 0) reach = engagements;
        if (impressions === 0 && engagements > 0) impressions = engagements;

        return {
          id: post.id,
          message: post.message || '',
          created_time: post.created_time,
          full_picture: post.full_picture || null,
          views: views,
          reach: reach,
          clicks: clicks,
          impressions: impressions,
          reactions: reactionsCount,
          comments: commentsCount,
          shares: sharesCount,
          engagements
        };
      }));

      /** Sắp xếp theo tương tác giảm dần */
      posts.sort((a, b) => b.engagements - a.engagements);

      /** Lấy URL bài gốc để hiển thị trên frontend */
      try {
        const postIdsToSearch = posts.flatMap(p => p.id.includes('_') ? [p.id, p.id.split('_')[1]] : [p.id]);
        
        const [reels, images] = await Promise.all([
          this.prisma.ztteam_reels.findMany({
            where: { fb_post_id: { in: postIdsToSearch }, wp_post_url: { not: null } },
            select: { fb_post_id: true, wp_post_url: true }
          }),
          this.prisma.ztteam_images.findMany({
            where: { fb_post_id: { in: postIdsToSearch }, wp_post_url: { not: null } },
            select: { fb_post_id: true, wp_post_url: true }
          })
        ]);

        const urlMap = new Map<string, string>();
        for (const r of reels) if (r.fb_post_id && r.wp_post_url) urlMap.set(r.fb_post_id, r.wp_post_url);
        for (const i of images) if (i.fb_post_id && i.wp_post_url) urlMap.set(i.fb_post_id, i.wp_post_url);

        for (const p of posts) {
          const shortId = p.id.includes('_') ? p.id.split('_')[1] : p.id;
          p.wp_post_url = urlMap.get(p.id) || urlMap.get(shortId) || null;
        }
      } catch (e: any) {
        this.logger.warn(`Failed to attach wp_post_url: ${e.message}`);
      }

      return posts;
    } catch (error: any) {
      this.logger.warn(`Failed to fetch top posts for page ${pageId}:`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Publish a generated Reel to the Fanpage
   */
  async ztteam_publishReel(pageId: string, videoPath: string, description: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId }
    });

    if (!page || !page.page_token_encrypted) {
      throw new Error('Fanpage không tồn tại hoặc chưa cấu hình token');
    }

    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const form = new FormData();
      form.append('access_token', page.page_token_encrypted);
      form.append('description', description);
      form.append('source', fs.createReadStream(videoPath));

      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/${this.API_VERSION}/${pageId}/videos`,
          form,
          { headers: form.getHeaders(), maxBodyLength: Infinity }
        )
      );

      return response.data;
    } catch (error: any) {
      this.logger.error('Error publishing reel to Facebook', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Publish a comment to a Facebook post
   */
  /**
   * Publish a generated Photo to the Fanpage
   */
  async ztteam_publishPhoto(pageId: string, imagePath: string, message: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId }
    });

    if (!page || !page.page_token_encrypted) {
      throw new Error('Fanpage không tồn tại hoặc chưa cấu hình token');
    }

    try {
      const FormData = require('form-data');
      const fs = require('fs');
      const form = new FormData();
      form.append('access_token', page.page_token_encrypted);
      form.append('message', message);
      form.append('source', fs.createReadStream(imagePath));

      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/${this.API_VERSION}/${pageId}/photos`,
          form,
          { headers: form.getHeaders(), maxBodyLength: Infinity }
        )
      );

      return response.data.id || response.data.post_id;
    } catch (error: any) {
      this.logger.error('Error publishing photo to Facebook', error.response?.data || error.message);
      throw error;
    }
  }

  async ztteam_publishComment(pageId: string, postId: string, message: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId }
    });

    if (!page || !page.page_token_encrypted) {
      throw new Error('Fanpage không tồn tại hoặc chưa cấu hình token');
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://graph.facebook.com/${this.API_VERSION}/${postId}/comments`,
          { message, access_token: page.page_token_encrypted }
        )
      );
      return response.data;
    } catch (error: any) {
      this.logger.error('Error publishing comment to Facebook', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Xóa 1 Fanpage và toàn bộ dữ liệu liên quan (Reels, Images, History, Sources).
   * Xóa tường minh từng bảng, KHÔNG dựa vào cascade.
   */
  async ztteam_deletePage(pageId: string, userId: string) {
    const fs = require('fs');
    const { ztteam_getReelsPath, ztteam_getImagesPath } = require('../common/ztteam_storage.util');

    /** Kiểm tra page tồn tại và thuộc quyền user (hỗ trợ cả fb_page_id và id) */
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { 
        OR: [
          { id: pageId },
          { fb_page_id: pageId }
        ]
      },
      include: { fb_account: true },
    });

    if (!page) {
      throw new BadRequestException('Fanpage không tồn tại');
    }

    if (page.fb_account.owner_user_id !== userId) {
      throw new BadRequestException('Bạn không có quyền xóa Fanpage này');
    }

    const internalPageId = page.id;

    /** 1. Xóa file video vật lý + record Reels */
    const reels = await this.prisma.ztteam_reels.findMany({ where: { page_id: internalPageId } });
    for (const reel of reels) {
      try {
        const reelDir = ztteam_getReelsPath(reel.id);
        if (fs.existsSync(reelDir)) {
          fs.rmSync(reelDir, { recursive: true, force: true });
        }
      } catch (e) {
        this.logger.warn(`Error deleting reel files for ${reel.id}`, e);
      }
    }
    await this.prisma.ztteam_reels.deleteMany({ where: { page_id: internalPageId } });

    /** 2. Xóa file ảnh vật lý + record Images */
    const images = await this.prisma.ztteam_images.findMany({ where: { page_id: internalPageId } });
    for (const image of images) {
      try {
        const imageDir = ztteam_getImagesPath(image.id);
        if (fs.existsSync(imageDir)) {
          fs.rmSync(imageDir, { recursive: true, force: true });
        }
      } catch (e) {
        this.logger.warn(`Error deleting image files for ${image.id}`, e);
      }
    }
    await this.prisma.ztteam_images.deleteMany({ where: { page_id: internalPageId } });

    /** 3. Xóa lịch sử Reel */
    await this.prisma.ztteam_reel_history.deleteMany({ where: { page_id: internalPageId } });

    /** 4. Xóa nguồn WP gán cho Page */
    await this.prisma.ztteam_page_sources.deleteMany({ where: { page_id: internalPageId } });

    /** 5. Xóa bản ghi Page */
    await this.prisma.ztteam_pages.delete({ where: { id: internalPageId } });

    /** 6. Dọn dẹp FB Account nếu không còn Fanpage nào liên kết */
    if (page.fb_account_id) {
      const remainingPages = await this.prisma.ztteam_pages.count({
        where: { fb_account_id: page.fb_account_id }
      });
      if (remainingPages === 0) {
        await this.prisma.ztteam_fb_accounts.delete({ where: { id: page.fb_account_id } }).catch(() => null);
      }
    }

    return { message: `Đã xóa Fanpage "${page.name}" và toàn bộ dữ liệu liên quan` };
  }

  /**
   * Khắc phục rác dữ liệu: Tìm tất cả Fanpage bị trùng lặp fb_page_id,
   * gộp toàn bộ dữ liệu (Reels, History, Sources) về bản ghi gốc (bản được tạo đầu tiên),
   * sau đó xoá an toàn bản sao để dọn dẹp Database.
   */
  async ztteam_safeMergeDuplicates() {
    this.logger.log('Bắt đầu tiến trình gộp Fanpage trùng lặp (Safe Merge)...');
    
    /** Lấy tất cả Fanpage sắp xếp theo ngày tạo (cũ nhất đứng trước) */
    const pages = await this.prisma.ztteam_pages.findMany({
      orderBy: { fb_page_id: 'asc' } 
      /** Do ztteam_pages không có created_at nên ta ưu tiên id nào xuất hiện trước */
    });
    
    const groups = new Map<string, any[]>();
    for (const p of pages) {
      if (!groups.has(p.fb_page_id)) {
        groups.set(p.fb_page_id, []);
      }
      groups.get(p.fb_page_id)!.push(p);
    }
    
    const results = [];

    for (const [fb_page_id, duplicates] of groups.entries()) {
      if (duplicates.length > 1) {
        /** 
         * Ưu tiên chọn Bản gốc (Original) là trang có cấu hình đầy đủ nhất
         * (Ví dụ: có gắn Nguồn Crawler hoặc có gán Template Mặc định).
         * Tránh việc vô tình lấy trang rỗng của Manager làm gốc.
         */
        duplicates.sort((a, b) => {
          let scoreA = (a.default_reel_template_id ? 1 : 0) + (a.auto_create_enabled ? 1 : 0);
          let scoreB = (b.default_reel_template_id ? 1 : 0) + (b.auto_create_enabled ? 1 : 0);
          return scoreB - scoreA; /** Giảm dần, trang điểm cao nhất lên đầu */
        });

        const original = duplicates[0];
        const dupesToMerge = duplicates.slice(1);
        
        for (const dupe of dupesToMerge) {
          this.logger.log(`Đang gộp bản sao ${dupe.id} vào bản gốc ${original.id} (${original.name})`);
          
          /** 1. Move Reels */
          await this.prisma.ztteam_reels.updateMany({
            where: { page_id: dupe.id },
            data: { page_id: original.id }
          }).catch(() => null);
          
          /** 2. Move Images */
          await this.prisma.ztteam_images.updateMany({
            where: { page_id: dupe.id },
            data: { page_id: original.id }
          }).catch(() => null);
          
          /** 3. Move Page Sources */
          await this.prisma.ztteam_page_sources.updateMany({
            where: { page_id: dupe.id },
            data: { page_id: original.id }
          }).catch(() => null);
          
          /** 4. Move Reel History (Xử lý Unique Constraints) */
          const dupeReelHistory = await this.prisma.ztteam_reel_history.findMany({ where: { page_id: dupe.id } });
          for (const history of dupeReelHistory) {
            try {
              await this.prisma.ztteam_reel_history.update({
                where: { id: history.id },
                data: { page_id: original.id }
              });
            } catch (e) {
              /** Lịch sử này đã tồn tại ở bản gốc, ta có thể xoá bỏ bản sao */
              await this.prisma.ztteam_reel_history.delete({ where: { id: history.id } }).catch(() => null);
            }
          }
          
          /** 5. Move Image History */
          const dupeImageHistory = await this.prisma.ztteam_image_history.findMany({ where: { page_id: dupe.id } });
          for (const history of dupeImageHistory) {
            try {
              await this.prisma.ztteam_image_history.update({
                where: { id: history.id },
                data: { page_id: original.id }
              });
            } catch (e) {
              await this.prisma.ztteam_image_history.delete({ where: { id: history.id } }).catch(() => null);
            }
          }
          
          /** 6. Xoá an toàn bản sao (bây giờ đã trống rỗng) */
          await this.prisma.ztteam_pages.delete({ where: { id: dupe.id } });
          
          results.push(`Đã gộp thành công bản sao ${dupe.id} vào Fanpage gốc ${original.name} (${original.id})`);
        }
      }
    }

    if (results.length === 0) {
      return { message: 'Không phát hiện Fanpage nào bị trùng lặp.' };
    }

    return { 
      message: 'Đã dọn dẹp và gộp thành công các Fanpage trùng lặp!', 
      details: results 
    };
  }

  async ztteam_togglePageActive(pageId: string, userId: string, isActive: boolean) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId, fb_account: { owner_user_id: userId } }
    });

    if (!page) {
      throw new BadRequestException('Fanpage không tồn tại hoặc bạn không có quyền truy cập');
    }

    const updated = await this.prisma.ztteam_pages.update({
      where: { id: page.id },
      data: { is_active: isActive }
    });

    return {
      success: true,
      message: isActive ? `Đã bật hoạt động cho Fanpage ${page.name}` : `Đã tắt Fanpage ${page.name}`,
      data: { id: updated.fb_page_id, isActive: updated.is_active }
    };
  }

  async ztteam_checkAccountHealth(userId: string, accountId?: string) {
    /** 1. Tự động dọn dẹp các bản ghi Nick FB trùng lặp bị rỗng (0 Fanpage) */
    try {
      const allAccounts = await this.prisma.ztteam_fb_accounts.findMany({
        where: { owner_user_id: userId },
        include: { pages: true }
      });
      
      const accByName = new Map<string, any[]>();
      for (const a of allAccounts) {
        const key = a.fb_user_id || a.name;
        if (!accByName.has(key)) accByName.set(key, []);
        accByName.get(key)!.push(a);
      }

      for (const [key, group] of accByName.entries()) {
        if (group.length > 1) {
          /** Sắp xếp tài khoản có nhiều Fanpage nhất lên đầu */
          group.sort((a, b) => b.pages.length - a.pages.length);
          const primaryAcc = group[0];
          const duplicates = group.slice(1);

          for (const dupe of duplicates) {
            if (dupe.pages.length === 0) {
              /** Xóa an toàn tài khoản rỗng trùng lặp */
              await this.prisma.ztteam_fb_accounts.delete({ where: { id: dupe.id } }).catch(() => null);
            } else {
              /** Chuyển Fanpage sang tài khoản chính rồi xóa tài khoản phụ */
              await this.prisma.ztteam_pages.updateMany({
                where: { fb_account_id: dupe.id },
                data: { fb_account_id: primaryAcc.id }
              }).catch(() => null);
              await this.prisma.ztteam_fb_accounts.delete({ where: { id: dupe.id } }).catch(() => null);
            }
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`Deduplicate fb accounts failed: ${e.message}`);
    }

    const whereAccount: any = { owner_user_id: userId };
    if (accountId) whereAccount.id = accountId;

    const accounts = await this.prisma.ztteam_fb_accounts.findMany({
      where: whereAccount,
      include: { pages: true }
    });

    const results: any[] = [];
    const sentAccountAlerts = new Set<string>();

    for (const acc of accounts) {
      const activePages = acc.pages.filter(p => p.is_active !== false);
      if (activePages.length === 0) {
        /** Skip checking account token if all pages are manually disabled */
        continue;
      }

      let isAccValid = true;
      let accErrorMsg = '';

      /** 1. Check FB User Token via Graph API */
      try {
        await firstValueFrom(
          this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/me`, {
            params: { access_token: acc.user_token_encrypted }
          })
        );
      } catch (err: any) {
        isAccValid = false;
        accErrorMsg = err.response?.data?.error?.message || err.message || 'Token hết hạn hoặc Nick bị checkpoint/đổi MK';
      }

      /** If User Token is invalid */
      if (!isAccValid) {
        /** Nếu Nick FB có 0 Fanpage ➔ Tự động xóa sạch tài khoản rỗng bị đứt kết nối khỏi DB */
        if (acc.pages.length === 0) {
          await this.prisma.ztteam_fb_accounts.delete({ where: { id: acc.id } }).catch(() => null);
          continue;
        }

        await this.prisma.ztteam_fb_accounts.update({
          where: { id: acc.id },
          data: { status: 'expired' }
        });

        await this.prisma.ztteam_pages.updateMany({
          where: { fb_account_id: acc.id },
          data: { token_status: 'expired' }
        });

        const alertKey = `${acc.fb_user_id || acc.name}`;
        if (!sentAccountAlerts.has(alertKey)) {
          sentAccountAlerts.add(alertKey);

          const affectedPages = activePages.map(p => p.name).join(', ');
          const warnMsg = `🚨 *[CẢNH BÁO NICK FACEBOOK BỊ LỖI TOKEN]*\n\n👤 *Nick quản lý*: ${acc.name}\n🚩 *Các Fanpage bị ảnh hưởng*: ${affectedPages}\n❌ *Chi tiết lỗi*: ${accErrorMsg}\n\n⚠️ *Hành động*: Vui lòng kết nối lại tài khoản Facebook trên giao diện Web để lấy Token mới!`;
          
          await this.telegramService.ztteam_sendMessage(warnMsg);
        }

        results.push({
          accountId: acc.id,
          accountName: acc.name,
          status: 'expired',
          error: accErrorMsg,
          pages: acc.pages.map(p => ({ pageId: p.fb_page_id, name: p.name, status: 'expired' }))
        });

        continue;
      }

      /** Account token valid */
      await this.prisma.ztteam_fb_accounts.update({
        where: { id: acc.id },
        data: { status: 'active' }
      });

      /** 2. Check each Page Token */
      const pageResults: any[] = [];
      for (const p of acc.pages) {
        if (p.is_active === false) continue;

        let isPageValid = true;
        let pageErrorMsg = '';

        try {
          await firstValueFrom(
            this.httpService.get(`https://graph.facebook.com/${this.API_VERSION}/${p.fb_page_id}`, {
              params: { fields: 'id,name', access_token: p.page_token_encrypted }
            })
          );
        } catch (err: any) {
          isPageValid = false;
          pageErrorMsg = err.response?.data?.error?.message || err.message;
        }

        const newStatus = isPageValid ? 'active' : 'expired';
        await this.prisma.ztteam_pages.update({
          where: { id: p.id },
          data: { token_status: newStatus, last_checked: new Date() }
        });

        if (!isPageValid) {
          const warnMsg = `🚨 *[CẢNH BÁO TOKEN FANPAGE BỊ HẾT HẠN]*\n\n👤 *Nick quản lý*: ${acc.name}\n🚩 *Fanpage*: ${p.name}\n❌ *Chi tiết*: ${pageErrorMsg}\n\n⚠️ Vui lòng kết nối lại tài khoản Facebook để lấy Token mới cho Fanpage!`;
          await this.telegramService.ztteam_sendMessage(warnMsg);
        }

        pageResults.push({
          pageId: p.fb_page_id,
          name: p.name,
          status: newStatus,
          error: pageErrorMsg || null
        });
      }

      results.push({
        accountId: acc.id,
        accountName: acc.name,
        status: 'active',
        pages: pageResults
      });
    }

    return {
      success: true,
      message: 'Đã kiểm tra xong sức khỏe Token tài khoản Facebook và Fanpage',
      data: results
    };
  }

  async ztteam_getConnectedAccounts(userId: string) {
    const accounts = await this.prisma.ztteam_fb_accounts.findMany({
      where: { owner_user_id: userId },
      include: { pages: true },
      orderBy: { created_at: 'desc' }
    });

    return accounts.map(acc => ({
      id: acc.id,
      fbUserId: acc.fb_user_id,
      name: acc.name,
      status: acc.status,
      pagesCount: acc.pages.length,
      pages: acc.pages.map(p => ({ id: p.fb_page_id, name: p.name })),
      createdAt: acc.created_at,
      updatedAt: acc.updated_at
    }));
  }

  async ztteam_deleteAccount(accountId: string, userId: string) {
    const acc = await this.prisma.ztteam_fb_accounts.findFirst({
      where: { id: accountId, owner_user_id: userId }
    });

    if (!acc) {
      throw new BadRequestException('Tài khoản Facebook không tồn tại hoặc bạn không có quyền xóa');
    }

    await this.prisma.ztteam_fb_accounts.delete({ where: { id: accountId } });

    return {
      success: true,
      message: `Đã xóa tài khoản Facebook ${acc.name} thành công!`
    };
  }

  async ztteam_autoCommentLink(pageId: string, fbPostId: string, manualLink?: string) {
    const page = await this.prisma.ztteam_pages.findFirst({
      where: { fb_page_id: pageId }
    });
    if (!page) throw new BadRequestException('Không tìm thấy Fanpage trong hệ thống');

    let trackingLink = '';
    
    /** Handle PAGEID_POSTID format from Facebook */
    const shortId = fbPostId.includes('_') ? fbPostId.split('_')[1] : fbPostId;

    if (manualLink) {
      trackingLink = manualLink;
      const utmCampaign = 'ztteam_auto_manual';
      trackingLink = `${trackingLink}${trackingLink.includes('?') ? '&' : '?'}utm_source=facebook&utm_medium=manual&utm_campaign=${utmCampaign}`;
    } else {
      const reel = await this.prisma.ztteam_reels.findFirst({
        where: { OR: [{ fb_post_id: fbPostId }, { fb_post_id: shortId }] }
      });
      const image = await this.prisma.ztteam_images.findFirst({
        where: { OR: [{ fb_post_id: fbPostId }, { fb_post_id: shortId }] }
      });

      const record = reel || image;
      if (!record) throw new BadRequestException('Bài viết này không được tạo từ hệ thống (Không tìm thấy trên Database)');
      if (!record.wp_post_url) throw new BadRequestException('Bài viết này không có link nguồn (wp_post_url)');

      trackingLink = record.wp_post_url;
      const utmMedium = reel ? 'reel' : 'image';
      const utmCampaign = 'ztteam_auto';
      trackingLink = `${trackingLink}${trackingLink.includes('?') ? '&' : '?'}utm_source=facebook&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}`;
    }

    const prefixes = ['👉 See details here:', '🔗 Original article link:', '👇 Full article link:'];
    const prefixIndex = Math.floor(Math.random() * prefixes.length);
    const message = `${prefixes[prefixIndex]}\n${trackingLink}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(`https://graph.facebook.com/${this.API_VERSION}/${fbPostId}/comments`, null, {
          params: {
            message: message,
            access_token: page.page_token_encrypted
          }
        })
      );
      return { success: true, message: 'Đã tự động bốc link và thả comment thành công!', id: response.data.id };
    } catch (error: any) {
      throw new BadRequestException(error.response?.data?.error?.message || error.message || 'Lỗi khi comment qua API Facebook');
    }
  }
}
