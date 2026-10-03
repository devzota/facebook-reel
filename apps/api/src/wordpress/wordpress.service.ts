import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { ZTTeamHtmlCleanerService } from './html-cleaner.service';
import { ztteam_getStorageRoot } from '../common/ztteam_storage.util';

@Injectable()
export class ZTTeamWordpressService {
  private readonly logger = new Logger(ZTTeamWordpressService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly htmlCleaner: ZTTeamHtmlCleanerService,
  ) {
    const secret = process.env.JWT_SECRET || 'default-secret-key-32-chars-long!';
    this.encryptionKey = crypto.scryptSync(secret, 'salt', 32);
  }

  private ztteam_encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private ztteam_decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    try {
      const [ivHex, encrypted] = encryptedText.split(':');
      if (!ivHex || !encrypted) return encryptedText;
      
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err: any) {
      this.logger.warn(`Decryption failed: ${err.message}.`);
      return encryptedText;
    }
  }

  async ztteam_testConnection(wpUrl: string, wpUsername: string, wpAppPassword: string) {
    try {
      const cleanUrl = wpUrl.replace(/\/$/, '');
      const authHeader = 'Basic ' + Buffer.from(`${wpUsername}:${wpAppPassword}`).toString('base64');
      
      const response = await firstValueFrom(
        this.httpService.get(`${cleanUrl}/wp-json/wp/v2/users/me`, {
          headers: {
            Authorization: authHeader,
          },
        })
      );
      
      return { success: true, data: { id: response.data.id, name: response.data.name } };
    } catch (error: any) {
      this.logger.error('WordPress connection test failed', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'Failed to connect to WordPress',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async ztteam_createTargetSite(userId: string, data: { wpUrl: string; wpUsername: string; wpAppPassword: string }) {
    await this.ztteam_testConnection(data.wpUrl, data.wpUsername, data.wpAppPassword);
    
    return this.prisma.ztteam_target_sites.create({
      data: {
        owner_user_id: userId,
        wp_url: data.wpUrl,
        wp_username: data.wpUsername,
        wp_app_password_encrypted: this.ztteam_encrypt(data.wpAppPassword),
        status: 'active'
      }
    });
  }

  async ztteam_updateTargetSite(userId: string, siteId: string, data: { wpUrl: string; wpUsername: string; wpAppPassword?: string }) {
    if (data.wpAppPassword) {
      await this.ztteam_testConnection(data.wpUrl, data.wpUsername, data.wpAppPassword);
    }
    
    const updateData: any = {
      wp_url: data.wpUrl,
      wp_username: data.wpUsername,
    };
    
    if (data.wpAppPassword) {
      updateData.wp_app_password_encrypted = this.ztteam_encrypt(data.wpAppPassword);
    }

    return this.prisma.ztteam_target_sites.update({
      where: { id: siteId, owner_user_id: userId },
      data: updateData
    });
  }

  async ztteam_getTargetSites(userId: string) {
    return this.prisma.ztteam_target_sites.findMany({
      where: { owner_user_id: userId },
      select: {
        id: true,
        wp_url: true,
        wp_username: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: {
          select: { crawl_sources: true }
        }
      }
    });
  }

  async ztteam_deleteTargetSite(userId: string, siteId: string) {
    return this.prisma.ztteam_target_sites.deleteMany({
      where: { id: siteId, owner_user_id: userId }
    });
  }

  ztteam_getAuthHeader(site: any): string {
    const wpAppPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    return 'Basic ' + Buffer.from(`${site.wp_username}:${wpAppPassword}`).toString('base64');
  }

  async ztteam_uploadMedia(
    wpUrl: string, 
    authHeader: string, 
    buffer: Buffer, 
    filename: string, 
    mimeType: string
  ): Promise<{ id: number; source_url: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${wpUrl}/wp-json/wp/v2/media`, buffer, {
          headers: {
            Authorization: authHeader,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Type': mimeType
          }
        })
      );
      return {
        id: response.data.id,
        source_url: response.data.source_url
      };
    } catch (error: any) {
      this.logger.error(`Failed to upload media to WordPress at ${wpUrl}/wp-json/wp/v2/media`, error.response?.data || error.message);
      throw error;
    }
  }

  async ztteam_deleteMedia(
    wpUrl: string,
    authHeader: string,
    mediaId: number
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${wpUrl}/wp-json/wp/v2/media/${mediaId}?force=true`, {
          headers: { Authorization: authHeader }
        })
      );
      this.logger.log(`Successfully deleted media #${mediaId} on WP`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to delete media #${mediaId} on WP: ${err.message}`);
      return false;
    }
  }

  async ztteam_updatePostFeaturedMedia(
    wpUrl: string,
    authHeader: string,
    postId: string | number,
    featuredMediaId: number
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.post(
          `${wpUrl}/wp-json/wp/v2/posts/${postId}`,
          { featured_media: featuredMediaId },
          {
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/json'
            }
          }
        )
      );
      this.logger.log(`Successfully updated WP post #${postId} with featured_media #${featuredMediaId}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to update WP post #${postId} featured_media: ${err.message}`);
      return false;
    }
  }

  async ztteam_deletePost(
    wpUrl: string,
    authHeader: string,
    postId: string | number
  ): Promise<boolean> {
    try {
      await firstValueFrom(
        this.httpService.delete(`${wpUrl}/wp-json/wp/v2/posts/${postId}?force=true`, {
          headers: { Authorization: authHeader }
        })
      );
      this.logger.log(`Successfully deleted WP post #${postId}`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to delete WP post #${postId}: ${err.message}`);
      return false;
    }
  }

  async ztteam_createPost(siteId: string, data: { title: string; content: string; excerpt?: string; categories?: number[]; tags?: number[]; imageUrl?: string | null }) {
    const site = await this.prisma.ztteam_target_sites.findUnique({
      where: { id: siteId }
    });

    if (!site) {
      throw new HttpException('Target site not found', HttpStatus.NOT_FOUND);
    }

    const wpAppPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    const authHeader = 'Basic ' + Buffer.from(`${site.wp_username}:${wpAppPassword}`).toString('base64');
    const cleanUrl = site.wp_url.replace(/\/$/, '');

    /** Clean HTML and Upload Images */
    let cleanContent = data.content;
    try {
      cleanContent = await this.htmlCleaner.ztteam_cleanHtmlAndUploadImages(
        data.content,
        async (buffer, filename, mimeType) => {
          const res = await this.ztteam_uploadMedia(cleanUrl, authHeader, buffer, filename, mimeType);
          return res.source_url;
        }
      );
    } catch (err: any) {
      this.logger.warn(`Failed to clean HTML or upload images: ${err.message}`);
      /** Fallback to original content if cleaner completely fails */
    }

    try {
      const payload: any = {
        title: data.title,
        content: cleanContent,
        status: 'publish',
      };
      if (data.excerpt) payload.excerpt = data.excerpt;
      if (data.categories && data.categories.length > 0) payload.categories = data.categories;
      if (data.tags && data.tags.length > 0) payload.tags = data.tags;

      /** Handle featured image (thumbnail) */
      if (data.imageUrl) {
        try {
          let buffer: Buffer;
          const ext = data.imageUrl.split('.').pop()?.split('?')[0] || 'png';

          if (data.imageUrl.startsWith('http://') || data.imageUrl.startsWith('https://')) {
            /** Download the image via HTTP */
            const imageRes = await firstValueFrom(
              this.httpService.get(data.imageUrl, { 
                responseType: 'arraybuffer', 
                timeout: 20000,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              })
            );
            buffer = Buffer.from(imageRes.data);
          } else {
            /** Read local image file from storage */
            let localFile: string;
            if (data.imageUrl.startsWith('/storage') || data.imageUrl.startsWith('storage')) {
              localFile = path.join(ztteam_getStorageRoot(), data.imageUrl.replace(/^\/?storage[/\\]?/, ''));
            } else if (fs.existsSync(data.imageUrl)) {
              localFile = data.imageUrl;
            } else {
              localFile = path.join(ztteam_getStorageRoot(), data.imageUrl.replace(/^[/\\]+/, ''));
            }
            if (!fs.existsSync(localFile)) {
              throw new Error(`Local image file not found: ${localFile}`);
            }
            buffer = fs.readFileSync(localFile);
          }

          const mimeType = ext.toLowerCase() === 'png' ? 'image/png' : ext.toLowerCase() === 'webp' ? 'image/webp' : 'image/jpeg';
          
          /** Upload to WP and set featured_media */
          const media = await this.ztteam_uploadMedia(cleanUrl, authHeader, buffer, `thumbnail_${Date.now()}.${ext}`, mimeType);
          if (media && media.id) {
            payload.featured_media = media.id;
            this.logger.log(`Successfully uploaded featured media to WP: Media ID ${media.id}`);
          }
        } catch (mediaErr: any) {
          this.logger.warn(`Failed to upload featured image for post: ${mediaErr.message}`);
        }
      }

      /** 1. Check if post with same title already exists */
      const searchResponse = await firstValueFrom(
        this.httpService.get(`${cleanUrl}/wp-json/wp/v2/posts`, {
          headers: { Authorization: authHeader },
          params: { search: data.title, status: 'any' }
        })
      );
      
      const existingPost = searchResponse.data.find((p: any) => p.title.rendered === data.title || p.title.raw === data.title);

      let response;
      if (existingPost) {
        /** Update existing post */
        response = await firstValueFrom(
          this.httpService.post(
            `${cleanUrl}/wp-json/wp/v2/posts/${existingPost.id}`,
            payload,
            {
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json'
              },
            }
          )
        );
      } else {
        /** Create new post */
        response = await firstValueFrom(
          this.httpService.post(
            `${cleanUrl}/wp-json/wp/v2/posts`,
            payload,
            {
              headers: {
                Authorization: authHeader,
                'Content-Type': 'application/json'
              },
            }
          )
        );
      }

      return {
        id: response.data.id,
        url: response.data.link
      };
    } catch (error: any) {
      this.logger.error(`Failed to create post on WordPress at ${cleanUrl}/wp-json/wp/v2/posts`, error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'Failed to create post on WordPress',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async ztteam_getCategories(siteId: string, userId: string) {
    let site = await this.prisma.ztteam_target_sites.findFirst({
      where: { id: siteId, owner_user_id: userId }
    });
    if (!site) {
      site = await this.prisma.ztteam_target_sites.findUnique({ where: { id: siteId } });
    }

    if (!site) throw new HttpException('Website WordPress không tồn tại trong hệ thống', HttpStatus.NOT_FOUND);

    const appPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    const authHeader = 'Basic ' + Buffer.from(`${site.wp_username}:${appPassword}`).toString('base64');
    let wpUrl = site.wp_url.replace(/\/$/, '');

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${wpUrl}/wp-json/wp/v2/categories`, {
          headers: { Authorization: authHeader },
          params: { per_page: 100 },
          timeout: 10000,
        })
      );
      
      return response.data.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        count: cat.count
      }));
    } catch (error: any) {
      this.logger.error('Failed to fetch categories from WordPress', error.response?.data || error.message);
      throw new HttpException('Lỗi khi lấy danh sách chuyên mục từ WordPress: ' + (error.response?.data?.message || error.message), HttpStatus.BAD_REQUEST);
    }
  }

  async ztteam_getTags(siteId: string, userId: string) {
    let site = await this.prisma.ztteam_target_sites.findFirst({
      where: { id: siteId, owner_user_id: userId }
    });
    if (!site) {
      site = await this.prisma.ztteam_target_sites.findUnique({ where: { id: siteId } });
    }

    if (!site) throw new HttpException('Website WordPress không tồn tại trong hệ thống', HttpStatus.NOT_FOUND);

    const appPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    const authHeader = 'Basic ' + Buffer.from(`${site.wp_username}:${appPassword}`).toString('base64');
    let wpUrl = site.wp_url.replace(/\/$/, '');

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${wpUrl}/wp-json/wp/v2/tags`, {
          headers: { Authorization: authHeader },
          params: { per_page: 100 },
          timeout: 10000,
        })
      );
      
      return response.data.map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        count: tag.count
      }));
    } catch (error: any) {
      this.logger.error('Failed to fetch tags from WordPress', error.response?.data || error.message);
      throw new HttpException('Lỗi khi lấy danh sách tag từ WordPress: ' + (error.response?.data?.message || error.message), HttpStatus.BAD_REQUEST);
    }
  }

  async ztteam_getPosts(siteId: string, userId: string, categoryId?: string, targetTags?: string) {
    let site = await this.prisma.ztteam_target_sites.findFirst({
      where: { id: siteId, owner_user_id: userId }
    });
    if (!site) {
      site = await this.prisma.ztteam_target_sites.findUnique({ where: { id: siteId } });
    }

    if (!site) throw new HttpException('Website WordPress không tồn tại trong hệ thống', HttpStatus.NOT_FOUND);

    const appPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    const authHeader = 'Basic ' + Buffer.from(`${site.wp_username}:${appPassword}`).toString('base64');
    let wpUrl = site.wp_url.replace(/\/$/, '');

    try {
      const params: any = { per_page: 20, _embed: 1 };
      if (categoryId) params.categories = categoryId;
      if (targetTags) params.tags = targetTags;
      
      const response = await firstValueFrom(
        this.httpService.get(`${wpUrl}/wp-json/wp/v2/posts`, {
          headers: { Authorization: authHeader },
          params,
          timeout: 12000,
        })
      );
      
      return response.data.map((p: any) => {
        const rawContent = p.content?.rendered || p.title?.rendered || '';
        const cleanContent = rawContent.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
        const rawExcerpt = p.excerpt?.rendered || cleanContent.substring(0, 180);
        const cleanExcerpt = rawExcerpt.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();

        /** Extract image URL */
        let imageUrl: string | null = null;
        if (p._embedded?.['wp:featuredmedia']?.[0]?.source_url) {
          imageUrl = p._embedded['wp:featuredmedia'][0].source_url;
        } else {
          const imgMatch = p.content?.rendered?.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
          if (imgMatch) imageUrl = imgMatch[1];
        }

        return {
          id: p.id,
          title: (p.title?.rendered || 'No Title').replace(/<[^>]*>?/gm, ''),
          date: p.date,
          link: p.link,
          content: cleanContent,
          excerpt: cleanExcerpt,
          imageUrl: imageUrl,
        };
      });
    } catch (e: any) {
      this.logger.error('Failed to get posts from WP', e.response?.data || e.message);
      throw new HttpException(
        'Không thể kết nối đến WordPress: ' + (e.response?.data?.message || e.message),
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async ztteam_getSamplePost(siteId: string, userId: string, categoryId?: string, targetTags?: string) {
    let site = await this.prisma.ztteam_target_sites.findFirst({
      where: { id: siteId, owner_user_id: userId }
    });
    if (!site) {
      site = await this.prisma.ztteam_target_sites.findUnique({ where: { id: siteId } });
    }

    if (!site) throw new HttpException('Website WordPress không tồn tại trong hệ thống', HttpStatus.NOT_FOUND);

    const appPassword = this.ztteam_decrypt(site.wp_app_password_encrypted);
    const authHeader = 'Basic ' + Buffer.from(`${site.wp_username}:${appPassword}`).toString('base64');
    let wpUrl = site.wp_url.replace(/\/$/, '');

    try {
      const params: any = { per_page: 1, _fields: 'id,title,content' };
      if (categoryId) params.categories = categoryId;
      if (targetTags) params.tags = targetTags;

      const response = await firstValueFrom(
        this.httpService.get(`${wpUrl}/wp-json/wp/v2/posts`, {
          headers: { Authorization: authHeader },
          params,
          timeout: 10000,
        })
      );
      
      if (response.data && response.data.length > 0) {
        const post = response.data[0];
        /** Strip HTML from content */
        const rawContent = post.content?.rendered || post.title?.rendered || '';
        const cleanContent = rawContent.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
        return {
          id: post.id,
          title: post.title?.rendered,
          content: cleanContent
        };
      }
      return null;
    } catch (e: any) {
      this.logger.error('Failed to get sample post from WP', e.response?.data || e.message);
      return null;
    }
  }
}
