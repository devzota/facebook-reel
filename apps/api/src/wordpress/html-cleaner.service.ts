import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as cheerio from 'cheerio';
import { firstValueFrom } from 'rxjs';
import { extname } from 'path';

@Injectable()
export class ZTTeamHtmlCleanerService {
  private readonly logger = new Logger(ZTTeamHtmlCleanerService.name);

  constructor(private readonly httpService: HttpService) {}

  async ztteam_cleanHtmlAndUploadImages(
    html: string,
    uploadMediaFn: (buffer: Buffer, filename: string, mimeType: string) => Promise<string>
  ): Promise<string> {
    const $ = cheerio.load(html, undefined, false);

    /** 1. Remove unwanted tags */
    $('script, style, noscript, iframe, form, button, input, select, textarea').remove();

    /** 2. Remove all attributes from all elements EXCEPT src and alt for img */
    $('*').each((_, el) => {
      if (el.type === 'tag') {
        const allowedAttrs = el.tagName.toLowerCase() === 'img' ? ['src', 'alt'] : [];
        const attribs = { ...el.attribs }; /** clone to iterate */
        for (const attr in attribs) {
          if (!allowedAttrs.includes(attr.toLowerCase())) {
            $(el).removeAttr(attr);
          }
        }
      }
    });

    /** 3. Handle <a> tags: remove external links or replace with text */
    /** Let's remove the <a> tag but keep the inner text */
    $('a').each((_, el) => {
      const text = $(el).text();
      $(el).replaceWith(text);
    });

    /** 4. Unwrap div and span tags to keep just the semantic structure (p, img, h1-h6) */
    /** We do this repeatedly until there are no div or span tags left */
    let hasDivsOrSpans = true;
    while (hasDivsOrSpans) {
      const wrappers = $('div, span');
      if (wrappers.length === 0) {
        hasDivsOrSpans = false;
      } else {
        wrappers.each((_, el) => {
          $(el).replaceWith($(el).contents());
        });
      }
    }

    /** 5. Remove empty paragraphs and empty headings */
    $('p, h1, h2, h3, h4, h5, h6').each((_, el) => {
      const text = $(el).text().trim();
      const hasImg = $(el).find('img').length > 0;
      if (!text && !hasImg) {
        $(el).remove();
      }
    });

    /** 3. Process <img> tags */
    const images = $('img').toArray();
    for (const img of images) {
      const src = $(img).attr('src');
      if (!src) continue;

      try {
        /** Download image */
        const response = await firstValueFrom(
          this.httpService.get(src, { responseType: 'arraybuffer' })
        );

        const buffer = Buffer.from(response.data, 'binary');
        const contentType = response.headers['content-type'] as string | undefined;
        let ext = '.jpg';
        
        if (contentType) {
          if (contentType.includes('png')) ext = '.png';
          else if (contentType.includes('webp')) ext = '.webp';
          else if (contentType.includes('gif')) ext = '.gif';
          else if (contentType.includes('jpeg')) ext = '.jpg';
        } else {
           const parsedExt = extname(src.split('?')[0]);
           if (parsedExt) ext = parsedExt;
        }

        const filename = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
        
        /** Upload to WordPress */
        const newUrl = await uploadMediaFn(buffer, filename, contentType || 'image/jpeg');
        
        /** Replace src */
        $(img).attr('src', newUrl);
        /** Remove lazy loading attributes if any */
        $(img).removeAttr('loading').removeAttr('srcset').removeAttr('sizes');

      } catch (error: any) {
        this.logger.error(`Failed to process image: ${src}`, error.message);
        /** If image fails, you might want to remove it or keep the original */
        /** Let's remove it to keep content clean of broken external links */
        $(img).remove();
      }
    }

    return $.html();
  }
}
