import { Injectable, Logger, HttpException, HttpStatus, Inject, forwardRef } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { ZTTeamFetcherService } from './fetcher.service';
import { ZTTeamWordpressService } from '../wordpress/wordpress.service';
import { ZTTeamStoryTestService } from '../story-test/story-test.service';
import { ztteam_getImagesPath } from '../common/ztteam_storage.util';

@Injectable()
export class ZTTeamCrawlerService {
  private readonly logger = new Logger(ZTTeamCrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcherService: ZTTeamFetcherService,
    private readonly wordpressService: ZTTeamWordpressService,
    @Inject(forwardRef(() => ZTTeamStoryTestService))
    private readonly storyTestService: ZTTeamStoryTestService,
  ) {}

  /**
   * Complete automated story processing pipeline:
   * 1. Crawl clean story content via Smart Proxy (bypasses Cloudflare / geo-block)
   * 2. AI generates dramatic scene prompt & renders 2K image via SangTao.ai
   * 3. Post full story + 2K image (as Featured Image) to WordPress target site
   * 4. Prepare Fanpage post resource:
   *    - Attached image: 2K SangTao.ai image
   *    - Content: TITLE VIẾT HOA + Part 1 / Hook kịch tính
   *    - First comment: Link đọc full câu chuyện trên website đích (tuỳ chọn)
   */
  async ztteam_crawlAndPublishStory(params: {
    sourceId?: string;
    sourceUrl: string;
    targetSiteId: string;
    pageId?: string;
    addLinkToComment?: boolean;
    sourceCategory?: string;
  }): Promise<{
    success: boolean;
    title: string;
    wpPostId: number;
    wpPostUrl: string;
    image2kUrl: string;
    fanpageCaption: string;
    firstComment?: string;
    pageId?: string;
    imageId?: string;
  }> {
    const { sourceUrl, targetSiteId, pageId, addLinkToComment = true, sourceCategory } = params;

    this.logger.log(`Starting Crawl -> 2K AI Image -> WordPress -> Fanpage pipeline for: ${sourceUrl}`);

    /** 1. Fetch & clean story from source URL */
    const storyData = await this.fetcherService.ztteam_fetchUrlData(sourceUrl);
    if (!storyData || !storyData.title || !storyData.content) {
      throw new HttpException('Không thể lấy nội dung câu chuyện từ link nguồn', HttpStatus.BAD_REQUEST);
    }

    const cleanContent = this.fetcherService.ztteam_cleanStoryContent(storyData.content);
    const storyTitle = storyData.title.trim();

    /** 2. AI generates scene prompt & renders 2K Image via SangTao.ai */
    this.logger.log(`Analyzing story and generating 2K image via SangTao.ai for "${storyTitle}"...`);
    const promptData = await this.storyTestService.ztteam_generateStoryImagePrompt(
      cleanContent,
      'cinematic',
      '4:5',
    );

    const imageResult = await this.storyTestService.ztteam_renderStoryImage({
      prompt: promptData.image_prompt_en,
      aspectRatio: '4:5',
    });

    const image2kUrl = imageResult.imageUrl;
    this.logger.log(`SangTao.ai 2K image generated: ${image2kUrl}`);

    /** 3. Post to WordPress Target Site with 2K image as Featured Media */
    const wpResult = await this.wordpressService.ztteam_createPost(targetSiteId, {
      title: storyTitle,
      content: cleanContent,
      excerpt: cleanContent.substring(0, 200) + '...',
      categories: sourceCategory ? [Number(sourceCategory)] : undefined,
      imageUrl: image2kUrl,
    });

    this.logger.log(`Posted to WordPress: ID=${wpResult.id}, URL=${wpResult.url}`);

    /** 4. Prepare Fanpage Resource: TITLE VIẾT HOA + Part 1 kịch tính */
    const titleUppercase = storyTitle.toUpperCase();
    const part1Hook = this.fetcherService.ztteam_extractPart1Hook(cleanContent, 900);

    /** 5. Determine Target Fanpage (Exclusive 1 Post per Fanpage across same Source & Category) */
    const targetPages: any[] = [];
    if (pageId) {
      const p = await this.prisma.ztteam_pages.findUnique({ where: { id: pageId } });
      if (p) targetPages.push(p);
    } else {
      /** Find candidate active pages sharing this target site & category */
      const categoryConditions: any[] = [
        { target_category_id: null },
        { target_category_id: '' },
      ];
      if (sourceCategory) {
        categoryConditions.push({ target_category_id: String(sourceCategory) });
      }

      const linkedSources = await this.prisma.ztteam_page_sources.findMany({
        where: {
          target_site_id: targetSiteId,
          is_active: true,
          OR: categoryConditions,
        },
        include: { page: true },
      });

      const candidatePages: any[] = [];
      for (const ls of linkedSources) {
        if (ls.page && ls.page.is_active && !candidatePages.some(tp => tp.id === ls.page.id)) {
          candidatePages.push(ls.page);
        }
      }

      /** Check which pages have ALREADY posted or queued this WP post */
      const existingAssignments = await this.prisma.ztteam_images.findMany({
        where: { wp_post_id: wpResult.id.toString() },
        select: { page_id: true }
      });
      const usedPageIds = new Set(existingAssignments.map(a => a.page_id));

      const existingHistory = await this.prisma.ztteam_image_history.findMany({
        where: { wp_post_id: wpResult.id.toString() },
        select: { page_id: true }
      });
      existingHistory.forEach(h => usedPageIds.add(h.page_id));

      /** Filter candidate pages that haven't received this post yet */
      const eligiblePages = candidatePages.filter(p => !usedPageIds.has(p.id));

      if (eligiblePages.length > 0) {
        /** Fair round-robin / least loaded: pick the page with fewest unposted items in queue */
        let chosenPage = eligiblePages[0];
        if (eligiblePages.length > 1) {
          const loadCounts = await Promise.all(
            eligiblePages.map(async (p) => {
              const count = await this.prisma.ztteam_images.count({
                where: {
                  page_id: p.id,
                  status: { in: ['QUEUED', 'RENDERING', 'COMPLETED'] },
                  is_posted: false
                }
              });
              return { page: p, count };
            })
          );
          loadCounts.sort((a, b) => a.count - b.count);
          chosenPage = loadCounts[0].page;
        }
        targetPages.push(chosenPage);
        this.logger.log(`Assigned story #${wpResult.id} exclusively to Page: ${chosenPage.name} (${chosenPage.id})`);
      } else if (candidatePages.length === 0) {
        /** Fallback only if no candidate pages configured at all */
        const fallbackPage = await this.prisma.ztteam_pages.findFirst({
          where: { is_active: true },
        });
        if (fallbackPage) targetPages.push(fallbackPage);
      } else {
        this.logger.log(`Story #${wpResult.id} has already been assigned to all matching Fanpages. Skipping duplicate assignment.`);
      }
    }

    let createdImageId: string | undefined = undefined;

    for (const targetPage of targetPages) {
      /** Prepare Caption & First Comment based on this specific Fanpage settings */
      let fanpageCaption = `${titleUppercase}\n\n${part1Hook}`;
      if (targetPage.add_link_to_caption) {
        fanpageCaption += `\n\n👉 Read full story here: ${wpResult.url}`;
      }

      let firstCommentText: string | null = null;
      if (targetPage.add_link_to_comment || (addLinkToComment && targetPage.add_link_to_comment !== false)) {
        firstCommentText = `👉 Read the full story here: ${wpResult.url}`;
      }

      let imgRecord = await this.prisma.ztteam_images.findFirst({
        where: {
          page_id: targetPage.id,
          wp_post_id: wpResult.id.toString(),
        },
      });

      if (imgRecord) {
        imgRecord = await this.prisma.ztteam_images.update({
          where: { id: imgRecord.id },
          data: {
            wp_post_title: storyTitle,
            wp_post_url: wpResult.url,
            template_id: 'sangtao_2k',
            image_url: image2kUrl,
            ai_caption: fanpageCaption,
            ai_first_comment: firstCommentText,
            status: 'COMPLETED',
            created_at: new Date(), /** Update timestamp to reflect exact recent crawl/render time */
            updated_at: new Date(),
          },
        });
      } else {
        imgRecord = await this.prisma.ztteam_images.create({
          data: {
            page_id: targetPage.id,
            wp_post_id: wpResult.id.toString(),
            wp_post_title: storyTitle,
            wp_post_url: wpResult.url,
            template_id: 'sangtao_2k',
            image_url: image2kUrl,
            ai_caption: fanpageCaption,
            ai_first_comment: firstCommentText,
            status: 'COMPLETED', /** Ready for publisher.cron to post to Facebook! */
          },
        });
      }
      if (!createdImageId) createdImageId = imgRecord.id;

      /** Copy image to standard storage folder so publisher.cron and manual publish can find it */
      try {
        const targetDir = ztteam_getImagesPath(imgRecord.id);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(imageResult.localPath, path.join(targetDir, 'output.png'));

        await this.prisma.ztteam_images.update({
          where: { id: imgRecord.id },
          data: {
            image_url: `/storage/images/${imgRecord.id}/output.png`,
          },
        });
      } catch (copyErr: any) {
        this.logger.warn(`Failed to copy image to standard folder: ${copyErr.message}`);
      }

      this.logger.log(`Created Fanpage ready-to-post image item: ${imgRecord.id} for Page ${targetPage.id} (${targetPage.name})`);
    }

    /** 6. Record to crawl history for Dashboard & UI tracking */
    try {
      let source: any = null;
      if (params.sourceId) {
        source = await this.prisma.ztteam_crawl_sources.findUnique({
          where: { id: params.sourceId },
        });
      }
      if (!source) {
        source = await this.prisma.ztteam_crawl_sources.findFirst({
          where: { target_site_id: targetSiteId },
        });
      }
      if (!source) {
        source = await this.prisma.ztteam_crawl_sources.create({
          data: {
            target_site_id: targetSiteId,
            source_url: sourceUrl,
            source_category: sourceCategory || 'manual',
            frequency_cron: '0 * * * *',
            enabled: false,
            extract_rules_json: JSON.stringify({ manual: true }),
          },
        });
      }

      await this.prisma.ztteam_crawl_history.upsert({
        where: {
          source_id_url: {
            source_id: source.id,
            url: sourceUrl,
          },
        },
        update: {
          title: storyTitle,
          status: 'SUCCESS',
        },
        create: {
          source_id: source.id,
          url: sourceUrl,
          title: storyTitle,
          status: 'SUCCESS',
        },
      });
    } catch (histErr: any) {
      this.logger.warn(`Failed to save crawl history: ${histErr.message}`);
    }

    const primaryPage = targetPages[0];
    const primaryCaption = `${titleUppercase}\n\n${part1Hook}` + (primaryPage?.add_link_to_caption ? `\n\n👉 Read full story here: ${wpResult.url}` : '');
    const primaryComment = primaryPage?.add_link_to_comment ? `👉 Read the full story here: ${wpResult.url}` : undefined;

    return {
      success: true,
      title: storyTitle,
      wpPostId: wpResult.id,
      wpPostUrl: wpResult.url,
      image2kUrl,
      fanpageCaption: primaryCaption,
      firstComment: primaryComment,
      pageId: primaryPage?.id,
      imageId: createdImageId,
    };
  }

  async ztteam_createSource(siteId: string, data: { sourceUrl: string; sourceCategory: string; frequencyCron: string; addLinkToComment?: boolean; batchSize?: number }) {
    try {
      const extractRules = {
        addLinkToComment: data.addLinkToComment !== undefined ? data.addLinkToComment : true,
        batchSize: data.batchSize ? Math.max(1, Math.min(10, Number(data.batchSize))) : 1,
      };
      return await this.prisma.ztteam_crawl_sources.create({
        data: {
          target_site_id: siteId,
          source_url: data.sourceUrl,
          source_category: data.sourceCategory,
          extract_rules_json: JSON.stringify(extractRules),
          frequency_cron: data.frequencyCron,
          enabled: true
        }
      });
    } catch (error: any) {
      this.logger.error('Failed to create crawl source', error);
      throw new HttpException('Failed to create crawl source', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async ztteam_updateSource(sourceId: string, data: { sourceUrl: string; sourceCategory: string; frequencyCron: string; addLinkToComment?: boolean; batchSize?: number }) {
    const existing = await this.prisma.ztteam_crawl_sources.findUnique({ where: { id: sourceId } });
    let extractRules: any = {};
    try {
      extractRules = JSON.parse(existing?.extract_rules_json || '{}');
    } catch (e) {}

    /** Always clear out legacy targetPageId to ensure dynamic multi-page distribution */
    delete extractRules.targetPageId;

    if (data.addLinkToComment !== undefined) {
      extractRules.addLinkToComment = data.addLinkToComment;
    }
    if (data.batchSize !== undefined) {
      extractRules.batchSize = Math.max(1, Math.min(10, Number(data.batchSize)));
    }

    return this.prisma.ztteam_crawl_sources.update({
      where: { id: sourceId },
      data: {
        source_url: data.sourceUrl,
        source_category: data.sourceCategory,
        frequency_cron: data.frequencyCron,
        extract_rules_json: JSON.stringify(extractRules),
      }
    });
  }

  async ztteam_getSources(siteId: string) {
    const sources = await this.prisma.ztteam_crawl_sources.findMany({
      where: { target_site_id: siteId },
      orderBy: { created_at: 'desc' },
      include: {
        history: {
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    });

    return sources.map((source: any) => {
      const lastCrawl = source.history && source.history.length > 0 ? source.history[0].created_at : null;
      let nextCrawl = null;
      
      if (source.enabled) {
        let intervalMs = 1 * 60 * 60 * 1000;
        switch (source.frequency_cron) {
          case '0 */5 * * * *': intervalMs = 5 * 60 * 1000; break;
          case '0 */15 * * * *': intervalMs = 15 * 60 * 1000; break;
          case '0 */30 * * * *': intervalMs = 30 * 60 * 1000; break;
          case '0 */1 * * *': intervalMs = 1 * 60 * 60 * 1000; break;
          case '0 */2 * * *': intervalMs = 2 * 60 * 60 * 1000; break;
          case '0 */3 * * *': intervalMs = 3 * 60 * 60 * 1000; break;
          case '0 */6 * * *': intervalMs = 6 * 60 * 60 * 1000; break;
          case '0 */12 * * *': intervalMs = 12 * 60 * 60 * 1000; break;
          case '0 0 * * *': intervalMs = 24 * 60 * 60 * 1000; break;
        }
        
        if (lastCrawl) {
          nextCrawl = new Date(new Date(lastCrawl).getTime() + intervalMs);
        } else {
          nextCrawl = new Date();
        }
      }

      const { history, ...rest } = source;
      return {
        ...rest,
        last_crawled_at: lastCrawl,
        next_crawl_at: nextCrawl
      };
    });
  }

  async ztteam_deleteSource(sourceId: string) {
    return this.prisma.ztteam_crawl_sources.delete({
      where: { id: sourceId }
    });
  }

  async ztteam_toggleSource(sourceId: string, enabled: boolean) {
    return this.prisma.ztteam_crawl_sources.update({
      where: { id: sourceId },
      data: { enabled }
    });
  }

  async ztteam_getHistory(sourceId: string, limit = 50) {
    return this.prisma.ztteam_crawl_history.findMany({
      where: { 
        source_id: sourceId,
        url: { not: 'SYNC_CHECK' }
      },
      orderBy: { created_at: 'desc' },
      take: limit
    });
  }

  async ztteam_deleteHistory(sourceId: string) {
    await this.prisma.ztteam_crawl_history.deleteMany({
      where: { source_id: sourceId }
    });
    return { success: true };
  }
}
