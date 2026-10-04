import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export interface ZTTeamFetchResult {
  title: string;
  image: string | null;
  images?: string[];
  content: string;
  contentHtml: string;
  excerpt: string;
  siteName: string | null;
  url: string;
}

@Injectable()
export class ZTTeamFetcherService {
  private readonly logger = new Logger(ZTTeamFetcherService.name);

  async ztteam_fetchHtml(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000), /** 15 seconds timeout */
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return response.text();
    } catch (error: any) {
      this.logger.error(`Failed to fetch HTML from ${url}`, error.stack);
      throw new HttpException(`Cannot fetch URL: ${error.message}`, HttpStatus.BAD_REQUEST);
    }
  }

  private ztteam_extractOgImage($: any): string | null {
    return (
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null
    );
  }

  private ztteam_extractSiteName($: any): string | null {
    return $('meta[property="og:site_name"]').attr("content") || null;
  }
  
  private ztteam_extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Unknown';
    }
  }

  private ztteam_parseReadability(
    html: string,
    url: string,
  ): {
    title: string;
    content: string;
    contentHtml: string;
    excerpt: string;
  } {
    const { document } = parseHTML(html);
    /** Ignore read-only baseURI error by using Object.defineProperty */
    Object.defineProperty(document, 'baseURI', { value: url, writable: true });
    
    /** @ts-ignore - Readability types can be tricky */
    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error("Không thể parse nội dung bài viết");
    }

    return {
      title: article.title || "",
      content:
        article.textContent
          ?.replace(/\t/g, " ")
          .replace(/[ ]{2,}/g, " ")
          .replace(/\. ([A-Z])/g, ".\n\n$1")
          .replace(/([.!?])\s+([A-Z])/g, "$1\n\n$2")
          .trim() || "",
      contentHtml: article.content || "",
      excerpt: article.excerpt || "",
    };
  }

  /**
   * Fallback bypass fetcher for geo-blocked, Cloudflare-protected, or anti-bot websites
   * Uses global proxy gateway (Jina Reader) located in US/EU to retrieve full story text & images
   */
  async ztteam_fetchViaBypassProxy(url: string): Promise<ZTTeamFetchResult> {
    this.logger.log(`Attempting bypass proxy fetch for geo-blocked/protected URL: ${url}`);
    const proxyUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      throw new Error(`Proxy bypass failed with status: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n');
    let title = '';
    for (const line of lines) {
      if (line.startsWith('Title:')) {
        title = line.replace('Title:', '').trim();
        break;
      }
    }

    const imgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
    const images: string[] = [];
    let m;
    while ((m = imgRegex.exec(text)) !== null) {
      images.push(m[1]);
    }

    /** Clean markdown headers, audio player artifacts (00:00), ad text, and image markdown from text */
    const cleanContent = this.ztteam_cleanStoryContent(text);

    return {
      title: title || this.ztteam_extractDomain(url),
      image: images[0] || null,
      images: [...new Set(images)],
      content: cleanContent,
      contentHtml: cleanContent,
      excerpt: cleanContent.substring(0, 200),
      siteName: this.ztteam_extractDomain(url),
      url,
    };
  }

  /**
   * Clean story text: ensure 100% of main narrative is kept, while removing all ads,
   * audio player strings, timestamps, social sharing buttons, viral engagement callouts,
   * navigation links, and disclaimer blocks.
   */
  ztteam_cleanStoryContent(rawText: string): string {
    let text = rawText
      .replace(/^Title:.*?\n/m, '')
      .replace(/^URL Source:.*?\n/m, '')
      .replace(/^Markdown Content:\n/m, '')
      .replace(/(?:00:00\s*)+/g, '')
      .replace(/(?:\b0?\d:\d{2}\s*)+/g, '') /** Strip loose timestamps like 0:00 */
      .replace(/!\[.*?\]\([^\s\)]+\)/g, '') /** Remove markdown images */
      /** Remove ad blocks, sponsored phrases, and cookie notices */
      .replace(/\[?(?:Advertisement|Sponsored Content|Promoted Stories|Related Stories|Share on Facebook|Share on Twitter|Pin it|Leave a Reply|Leave a comment|Cookie Policy|Accept Cookies)\]?/gi, '')
      /** Remove audio player strings */
      .replace(/(?:Audio Player|Listen to this story|Play audio|Pause audio)/gi, '')
      /** Remove viral engagement spam callouts (e.g. 'Type YES and I will post the rest') */
      .replace(/(?:The story is still unfolding[^\n]*|Type\s*["“']?YES["”']?[^\n]*|Comment\s*["“']?YES["”']?[^\n]*|Drop a\s*["“']?YES["”']?[^\n]*|Follow for part\s*\d+[^\n]*|Like and follow for part\s*\d+[^\n]*)/gi, '')
      /** Remove disclaimer at the very end if present */
      .replace(/Disclaimer:\s*This story is fictional[\s\S]*$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }

  /**
   * Extract the opening Part 1 / Hook of the story for the Facebook Fanpage post.
   * Takes the first section (e.g. up to Part 2 or ~200-300 words) ending cleanly at a sentence.
   */
  ztteam_extractPart1Hook(content: string, maxChars: number = 1000): string {
    if (!content) return '';

    /** If the story is explicitly marked with Part 1 and Part 2 */
    const part2Match = content.match(/Part\s*2\s*[:\-]/i);
    if (part2Match && part2Match.index && part2Match.index > 100) {
      let part1 = content.substring(0, part2Match.index).trim();
      /** Remove the Part 1: heading from beginning if present */
      part1 = part1.replace(/^Part\s*1\s*[:\-]\s*/i, '').trim();
      if (part1.length <= 1500) {
        return part1;
      }
    }

    /** Otherwise take the first few paragraphs up to maxChars, ending at a sentence boundary */
    let trimmed = content.replace(/^Part\s*1\s*[:\-]\s*/i, '').trim();
    if (trimmed.length <= maxChars) {
      return trimmed;
    }

    const slice = trimmed.substring(0, maxChars);
    const lastPeriod = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
    if (lastPeriod > 200) {
      return slice.substring(0, lastPeriod + 1).trim();
    }

    return slice.trim() + '...';
  }

  /**
   * Extract Part 1 (Hook for Caption) and Part 2 (Continuation for First Comment)
   * Tách câu chuyện thành 2 phần: Part 1 cho caption bài đăng và Part 2 cho bình luận lồng nhau.
   */
  ztteam_extractStoryParts(
    content: string,
    maxPart1Chars: number = 900,
    maxPart2Chars: number = 700
  ): { part1: string; part2: string } {
    if (!content) return { part1: '', part2: '' };

    let cleaned = content.replace(/^Part\s*1\s*[:\-]\s*/i, '').trim();

    /** 1. Trường hợp bài viết có đánh dấu Part 1 và Part 2 rõ ràng */
    const part2Regex = /Part\s*2\s*[:\-]/i;
    const part2Match = cleaned.match(part2Regex);

    if (part2Match && part2Match.index && part2Match.index > 100) {
      let part1 = cleaned.substring(0, part2Match.index).trim();
      let remainder = cleaned.substring(part2Match.index).trim();

      /** Loại bỏ tiêu đề Part 2: ở đầu đoạn */
      remainder = remainder.replace(/^Part\s*2\s*[:\-]\s*/i, '').trim();

      /** Kiểm tra nếu có Part 3 để không lấy tràn sang Part 3 */
      const part3Match = remainder.match(/Part\s*3\s*[:\-]/i);
      let part2Raw = part3Match && part3Match.index ? remainder.substring(0, part3Match.index).trim() : remainder;

      /** Giới hạn Part 2 vừa đủ dài theo quy chuẩn Facebook, kết thúc trọn vẹn tại dấu câu */
      let part2 = part2Raw;
      if (part2.length > maxPart2Chars) {
        const slice = part2.substring(0, maxPart2Chars);
        const lastPeriod = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
        if (lastPeriod > 150) {
          part2 = slice.substring(0, lastPeriod + 1).trim();
        } else {
          part2 = slice.trim() + '...';
        }
      }

      return { part1, part2 };
    }

    /** 2. Trường hợp câu chuyện liền mạch không có chữ Part 1, Part 2 */
    let part1 = cleaned;
    let remainder = '';

    if (cleaned.length > maxPart1Chars) {
      const slice = cleaned.substring(0, maxPart1Chars);
      const lastPeriod = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
      if (lastPeriod > 200) {
        part1 = slice.substring(0, lastPeriod + 1).trim();
        remainder = cleaned.substring(lastPeriod + 1).trim();
      } else {
        part1 = slice.trim();
        remainder = cleaned.substring(maxPart1Chars).trim();
      }
    }

    let part2 = '';
    if (remainder) {
      if (remainder.length > maxPart2Chars) {
        const slice = remainder.substring(0, maxPart2Chars);
        const lastPeriod = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
        if (lastPeriod > 150) {
          part2 = slice.substring(0, lastPeriod + 1).trim();
        } else {
          part2 = slice.trim() + '...';
        }
      } else {
        part2 = remainder;
      }
    }

    return { part1, part2 };
  }

  async ztteam_fetchUrlData(url: string): Promise<ZTTeamFetchResult> {
    try {
      /** Basic validation */
      new URL(url);
    } catch {
      throw new HttpException("URL không hợp lệ", HttpStatus.BAD_REQUEST);
    }

    try {
      const html = await this.ztteam_fetchHtml(url);

      /** Check if Cloudflare anti-bot page returned */
      if (
        html.includes('Attention Required! | Cloudflare') ||
        html.includes('cf-wrapper') ||
        html.includes('Sorry, you have been blocked')
      ) {
        this.logger.warn(`Cloudflare block detected on ${url}. Switching to bypass proxy...`);
        return await this.ztteam_fetchViaBypassProxy(url);
      }

      const $ = cheerio.load(html);

      const image = this.ztteam_extractOgImage($);
      const siteName = this.ztteam_extractSiteName($);
      const { title, content, contentHtml, excerpt } = this.ztteam_parseReadability(
        html,
        url,
      );

      let images: string[] = [];
      const content$ = cheerio.load(contentHtml);
      content$('img').each((_, el) => {
        const src = content$(el).attr('src') || content$(el).attr('data-src');
        if (src && src.startsWith('http')) {
          images.push(src);
        }
      });

      if (image) {
        const getBaseImg = (u: string) => {
          try {
            const urlObj = new URL(u);
            return urlObj.origin + urlObj.pathname.replace(/-\d+x\d+(?=\.[a-zA-Z0-9]+$)/, '');
          } catch(e) { return u; }
        };
        const baseOg = getBaseImg(image);
        images = images.filter(img => getBaseImg(img) !== baseOg);
      }

      return {
        title,
        image,
        images: [...new Set(images)],
        content,
        contentHtml,
        excerpt,
        siteName: siteName || this.ztteam_extractDomain(url),
        url,
      };
    } catch (directErr: any) {
      this.logger.warn(`Direct fetch failed for ${url} (${directErr.message}). Automatically switching to bypass proxy...`);
      return await this.ztteam_fetchViaBypassProxy(url);
    }
  }

  /**
   * Extract article links from a category or archive URL via Jina Proxy
   * when the source website is protected by Cloudflare or blocks Vietnam IPs.
   */
  async ztteam_extractArticleLinksViaProxy(categoryUrl: string): Promise<string[]> {
    this.logger.log(`Extracting article links via bypass proxy for category: ${categoryUrl}`);
    try {
      const proxyUrl = `https://r.jina.ai/${categoryUrl}`;
      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        throw new Error(`Proxy category fetch failed with status: ${response.status}`);
      }

      const text = await response.text();
      const baseDomain = this.ztteam_extractDomain(categoryUrl);
      const articleUrls = new Set<string>();

      /** Find all markdown links: [Title](URL) */
      const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
      let match;
      while ((match = linkRegex.exec(text)) !== null) {
        const linkHref = match[2];
        try {
          const u = new URL(linkHref);
          if (
            u.hostname === baseDomain &&
            u.pathname.length > 8 &&
            !u.pathname.endsWith('.png') &&
            !u.pathname.endsWith('.jpg') &&
            !u.pathname.endsWith('.jpeg') &&
            !u.pathname.endsWith('.webp') &&
            !u.pathname.includes('/category/') &&
            !u.pathname.includes('/tag/') &&
            !u.pathname.includes('/author/') &&
            !u.pathname.includes('/page/') &&
            !u.pathname.includes('/contact') &&
            !u.pathname.includes('/privacy') &&
            !u.pathname.includes('/terms') &&
            !u.pathname.includes('/about')
          ) {
            articleUrls.add(linkHref);
          }
        } catch (e) {
          /** Ignore invalid URLs */
        }
      }

      const results = Array.from(articleUrls);
      this.logger.log(`Found ${results.length} article links via bypass proxy on ${categoryUrl}`);
      return results;
    } catch (e: any) {
      this.logger.error(`Failed to extract article links via proxy: ${e.message}`);
      return [];
    }
  }
}

