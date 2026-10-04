import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ZTTeamFetcherService } from './fetcher.service';
import { ZTTeamWordpressService } from '../wordpress/wordpress.service';
import { ZTTeamCrawlerService } from './crawler.service';
import Parser from 'rss-parser';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ZTTeamCrawlerCron implements OnApplicationBootstrap {
  private readonly logger = new Logger(ZTTeamCrawlerCron.name);
  private rssParser: Parser;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcherService: ZTTeamFetcherService,
    private readonly wordpressService: ZTTeamWordpressService,
    private readonly telegramService: TelegramService,
    private readonly crawlerService: ZTTeamCrawlerService,
  ) {
    this.rssParser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
  }

  onApplicationBootstrap() {
    if (process.env.ENABLE_AUTO_CRON === 'false') {
      this.logger.log('Auto-Crawler Cron is disabled via ENABLE_AUTO_CRON=false');
      return;
    }
    this.logger.log('Application started, triggering initial crawler run...');
    this.ztteam_handleCron();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async ztteam_handleCron() {
    if (process.env.ENABLE_AUTO_CRON === 'false') {
      return;
    }
    if (this.isRunning) {
      this.logger.warn('Crawler cron is already running, skipping this tick');
      return;
    }
    this.isRunning = true;
    this.logger.log('Starting Auto-Crawler Cron...');

    try {
      const sources = await this.prisma.ztteam_crawl_sources.findMany({
        where: { enabled: true },
        include: { target_site: true },
        take: 50, /** Batch limit */
      });

      for (const source of sources) {
        if (!source.target_site) continue;
        
        /** Determine the interval in milliseconds based on frequency_cron */
        let intervalMs = 0;
        switch (source.frequency_cron) {
          case '0 */5 * * * *': intervalMs = 5 * 60 * 1000; break;
          case '0 */15 * * * *': intervalMs = 15 * 60 * 1000; break;
          case '0 */30 * * * *': intervalMs = 30 * 60 * 1000; break;
          case '0 */1 * * *': intervalMs = 1 * 60 * 60 * 1000; break;
          case '0 */2 * * *': intervalMs = 2 * 60 * 60 * 1000; break;
          case '0 */3 * * *': intervalMs = 3 * 60 * 60 * 1000; break;
          case '0 */4 * * *': intervalMs = 4 * 60 * 60 * 1000; break;
          case '0 */6 * * *': intervalMs = 6 * 60 * 60 * 1000; break;
          case '0 */12 * * *': intervalMs = 12 * 60 * 60 * 1000; break;
          case '0 0 * * *': intervalMs = 24 * 60 * 60 * 1000; break;
          default: intervalMs = 60 * 60 * 1000; /** Default 1 hour instead of 2 mins */
        }

        /** Check last crawl time */
        const lastCrawl = await this.prisma.ztteam_crawl_history.findFirst({
          where: { source_id: source.id },
          orderBy: { created_at: 'desc' }
        });

        if (lastCrawl) {
          const timeSinceLastCrawl = Date.now() - new Date(lastCrawl.created_at).getTime();
          if (timeSinceLastCrawl < intervalMs) {
            this.logger.debug(`Skipping source ${source.source_url} (Crawled recently. Next run in ${Math.round((intervalMs - timeSinceLastCrawl) / 60000)} mins)`);
            continue;
          }
        }

        this.logger.log(`Crawling source: ${source.source_url} for site: ${source.target_site.wp_url}`);
        
        try {
          await this.ztteam_crawlSource(source);
        } catch (error: any) {
          this.logger.error(`Failed to crawl source ${source.id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Crawler cron failed: ${error.message}`);
    } finally {
      this.isRunning = false;
      this.logger.log('Auto-Crawler Cron finished.');
    }
  }

  private async ztteam_crawlSource(source: any) {
    /** 1. Extract URLs from the source (Assuming it's an RSS feed for now) */
    const urlsToFetch: string[] = [];
    
    try {
      const feed = await this.rssParser.parseURL(source.source_url);
      if (feed.items && feed.items.length > 0) {
        /** Take the top 5 latest items to prevent overload */
        const items = feed.items.slice(0, 5);
        for (const item of items) {
          if (item.link) urlsToFetch.push(item.link);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to parse RSS for ${source.source_url}, falling back to HTML scraping: ${error.message}`);
      
      /** Fallback: fetch HTML and extract article links */
      try {
        const html = await this.fetcherService.ztteam_fetchHtml(source.source_url);
        const cheerio = require('cheerio');
        const $ = cheerio.load(html);
        
        /** Remove header, footer, nav, sidebars to avoid scraping "Page" links (About, Contact, Privacy) */
        $('header, footer, nav, aside, .sidebar, .widget, .menu, #menu, .nav-menu').remove();
        
        const baseUrl = new URL(source.source_url);
        const extractedUrls = new Set<string>();

        $('a').each((i: number, el: any) => {
          let href = $(el).attr('href');
          if (!href) return;
          
          try {
            /** Handle relative URLs */
            if (href.startsWith('/')) {
              href = `${baseUrl.origin}${href}`;
            }
            
            const linkUrl = new URL(href);
            
            /** Basic heuristics for an article link:
             * 1. Same domain
             * 2. Path is sufficiently long (usually > 15 chars for slug) or has hyphens
             * 3. Not a category, tag, author, or login page
             */
            if (linkUrl.hostname === baseUrl.hostname) {
              const path = linkUrl.pathname;
              if (
                path !== '/' &&
                path.length > 5 &&
                !path.includes('/category/') &&
                !path.includes('/tag/') &&
                !path.includes('/author/') &&
                !path.includes('/page/') &&
                !path.includes('/contact') &&
                !path.includes('/privacy') &&
                !path.includes('/terms') &&
                !path.includes('/about') &&
                !path.includes('wp-admin') &&
                !path.includes('wp-login')
              ) {
                extractedUrls.add(linkUrl.href);
              }
            }
          } catch (e) {
            /** Invalid URL, ignore */
          }
        });

        /** Take top 10 instead of 5 to get more articles */
        urlsToFetch.push(...Array.from(extractedUrls).slice(0, 10));
        
        if (urlsToFetch.length === 0) {
          this.logger.log(`No direct HTML links found on ${source.source_url}. Falling back to Smart Proxy extraction...`);
          const proxyLinks = await this.fetcherService.ztteam_extractArticleLinksViaProxy(source.source_url);
          urlsToFetch.push(...proxyLinks.slice(0, 10));
        }

        if (urlsToFetch.length === 0) {
          this.logger.warn(`Could not find any article links on ${source.source_url}`);
        } else {
          this.logger.log(`Extracted ${urlsToFetch.length} links from ${source.source_url}`);
        }
      } catch (htmlError: any) {
        this.logger.warn(`Direct HTML scrape failed for ${source.source_url}: ${htmlError.message}. Attempting Smart Proxy extraction...`);
        try {
          const proxyLinks = await this.fetcherService.ztteam_extractArticleLinksViaProxy(source.source_url);
          urlsToFetch.push(...proxyLinks.slice(0, 10));
        } catch (proxyErr: any) {
          this.logger.error(`Smart proxy extraction also failed for ${source.source_url}: ${proxyErr.message}`);
          urlsToFetch.push(source.source_url);
        }
      }
    }

    if (urlsToFetch.length === 0) {
      this.logger.warn(`No URLs found for source ${source.source_url}`);
      await this.ztteam_markSourceSyncTime(source.id);
      return;
    }

    /** Mark sync time immediately to lock the crawl interval (e.g. 6 hours) */
    await this.ztteam_markSourceSyncTime(source.id);

    /** 2. Fetch data for un-crawled URLs: Batch size configured in extract_rules_json (default 1) */
    let processedCount = 0;
    let maxArticlesPerCycle = 1;

    try {
      const rules = JSON.parse(source.extract_rules_json || '{}');
      if (rules.batchSize && Number(rules.batchSize) > 0) {
        maxArticlesPerCycle = Math.max(1, Math.min(10, parseInt(rules.batchSize, 10)));
      }
    } catch (e) {}

    let attemptCount = 0;

    for (const url of urlsToFetch) {
      if (attemptCount >= maxArticlesPerCycle) {
        break;
      }

      /** Kiểm tra thời gian thực: Nếu người dùng đã gạt TẮT nguồn này, dừng ngay lập tức */
      const freshSource = await this.prisma.ztteam_crawl_sources.findUnique({
        where: { id: source.id },
        select: { enabled: true }
      });
      if (!freshSource || !freshSource.enabled) {
        this.logger.log(`Source ${source.id} was toggled OFF by user. Stopping crawl loop immediately.`);
        break;
      }

      try {
        /** Check history */
        const history = await this.prisma.ztteam_crawl_history.findUnique({
          where: { source_id_url: { source_id: source.id, url } }
        });

        if (history) {
          /** Already processed this URL */
          continue;
        }

        /** Call full automated pipeline: Crawl clean story -> SangTao.ai 2K Image -> WordPress + 2K Featured Image -> Queue Fanpage (luân phiên Least-Loaded) */
        const result = await this.crawlerService.ztteam_crawlAndPublishStory({
          sourceId: source.id,
          sourceUrl: url,
          targetSiteId: source.target_site_id,
          sourceCategory: source.source_category,
        });

        await this.prisma.ztteam_crawl_history.upsert({
          where: { source_id_url: { source_id: source.id, url } },
          create: { source_id: source.id, url, title: result.title, status: 'SUCCESS' },
          update: { title: result.title, status: 'SUCCESS' }
        });

        this.logger.log(`Successfully processed story: "${result.title}" -> WP: ${result.wpPostUrl} | Fanpage Ready: ${result.imageId || 'N/A'}`);
        processedCount++;
        attemptCount++;
      } catch (err: any) {
        attemptCount++; /** Tăng lượt thử để không bao giờ chạy tràn lan khi lỗi */
        this.logger.error(`Failed to process URL ${url}: ${err.message}`);
        
        let sourceName = source.name || 'Không rõ';
        let memberEmail = 'N/A';
        if (source.target_site?.owner_user_id) {
          const u = await this.prisma.ztteam_users.findUnique({
            where: { id: source.target_site.owner_user_id },
            select: { email: true }
          });
          if (u) memberEmail = u.email;
        }

        this.telegramService.ztteam_sendMessage(
          `🚨 *[LỖI CRAWL BÀI VIẾT]*\n\n` +
          `👤 *Thành viên:* ${memberEmail}\n` +
          `🌐 *Website Nguồn:* ${sourceName}\n` +
          `🔗 *URL:* ${url}\n` +
          `❌ *Chi tiết lỗi:* ${err.message}`
        );
        
        try {
          await this.prisma.ztteam_crawl_history.upsert({
            where: { source_id_url: { source_id: source.id, url } },
            create: { source_id: source.id, url, status: 'FAILED' },
            update: { status: 'FAILED' }
          });
        } catch (e) {
          /** Ignore upsert error */
        }

        /** Circuit breaker: Nếu lỗi xác thực WordPress hoặc lỗi hệ thống nghiêm trọng, ngắt ngay vòng lặp */
        const isAuthOrForbidden = err.message?.toLowerCase().includes('forbidden') || 
                                 err.message?.toLowerCase().includes('401') || 
                                 err.message?.toLowerCase().includes('unauthorized') ||
                                 err.message?.toLowerCase().includes('status is forbidden');
        if (isAuthOrForbidden) {
          this.logger.error(`Circuit breaker triggered: WordPress auth error. Aborting remaining URLs to protect API quota.`);
          break;
        }
      }
    }
  }

  /** Update SYNC_CHECK record to mark the last time we checked this source */
  private async ztteam_markSourceSyncTime(sourceId: string): Promise<void> {
    try {
      const syncUrl = 'SYNC_CHECK';
      await this.prisma.ztteam_crawl_history.deleteMany({
        where: { source_id: sourceId, url: syncUrl }
      });
      await this.prisma.ztteam_crawl_history.create({
        data: { source_id: sourceId, url: syncUrl, status: 'SYNC' }
      });
    } catch (e: any) {
      this.logger.warn(`Could not update SYNC_CHECK for source ${sourceId}: ${e.message}`);
    }
  }
}
