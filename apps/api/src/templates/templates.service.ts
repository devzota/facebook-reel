import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { seedTemplates } from './seed.templates';

@Injectable()
export class ZTTeamTemplatesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ztteam_seedDefaultTemplates();
  }

  async ztteam_seedDefaultTemplates() {
    try {
      /** Auto-fix mojibake templates from database imports (only system templates) */
      await this.prisma.ztteam_templates.updateMany({
        where: { name: { contains: '2' }, format: 'image', fb_page_id: null },
        data: { name: 'Ghép 2 Ảnh (Nửa trái / Nửa phải)' }
      });
      await this.prisma.ztteam_templates.updateMany({
        where: { name: { contains: '3' }, format: 'image', fb_page_id: null },
        data: { name: 'Ghép 3 Ảnh (1 Trên, 2 Dưới)' }
      });
      await this.prisma.ztteam_templates.updateMany({
        where: { name: { contains: '4' }, format: 'image', fb_page_id: null },
        data: { name: 'Ghép 4 Ảnh (Lưới 2x2)' }
      });
      const templates = seedTemplates();
      for (const t of templates) {
        const duplicates = await this.prisma.ztteam_templates.findMany({
          where: { name: t.name, format: t.format, fb_page_id: null },
          orderBy: { id: 'asc' }
        });

        if (duplicates.length > 0) {
          const original = duplicates[0];
          
          /** Always update the html_content, layout and content_type of default templates to ensure they have the latest design */
          await this.prisma.ztteam_templates.update({
            where: { id: original.id },
            data: { 
              content_type: t.content_type,
              html_content: t.html_content,
              layout: t.layout as any,
              is_default: t.is_default
            }
          });

          if (duplicates.length > 1) {
            const duplicateIds = duplicates.slice(1).map(d => d.id);
            
            /** Re-link pages that were using the duplicates */
            await this.prisma.ztteam_pages.updateMany({
              where: { default_image_template_id: { in: duplicateIds } },
              data: { default_image_template_id: original.id }
            });
            await this.prisma.ztteam_pages.updateMany({
              where: { default_reel_template_id: { in: duplicateIds } },
              data: { default_reel_template_id: original.id }
            });

            /** Re-link images that were using the duplicates */
            await this.prisma.ztteam_images.updateMany({
              where: { template_id: { in: duplicateIds } },
              data: { template_id: original.id }
            });

            /** Delete the duplicates safely */
            await this.prisma.ztteam_templates.deleteMany({
              where: { id: { in: duplicateIds } }
            });
            console.log(`Cleaned up ${duplicateIds.length} duplicate templates for ${t.name}`);
          }
        } else {
          console.log(`Seeding missing template: ${t.name}`);
          await this.prisma.ztteam_templates.create({
            data: {
              name: t.name,
              format: t.format,
              content_type: t.content_type,
              voice_id: t.voice_id,
              video_y: t.video_y,
              video_radius: t.video_radius,
              html_content: t.html_content,
              layout: t.layout as any,
              is_default: t.is_default
            }
          });
        }
      }
      console.log('Template seed check complete.');
    } catch (error) {
      console.warn('Could not seed templates (tables might not exist yet):', error.message);
    }
  }

  async ztteam_getTemplates(format?: string, pageId?: string) {
    const where: any = {};
    if (format) where.format = format;
    if (pageId) {
      where.OR = [
        { fb_page_id: null },
        { fb_page_id: pageId }
      ];
    } else {
      where.fb_page_id = null; /** System templates only by default */
    }
    return this.prisma.ztteam_templates.findMany({ where, orderBy: { created_at: 'asc' } });
  }

  async ztteam_getTemplate(id: string) {
    return this.prisma.ztteam_templates.findUnique({ where: { id } });
  }

  async ztteam_createTemplate(data: any) {
    return this.prisma.ztteam_templates.create({ data });
  }

  async ztteam_cloneTemplate(templateId: string, pageId: string) {
    const original = await this.prisma.ztteam_templates.findUnique({ where: { id: templateId } });
    if (!original) throw new Error('Template not found');

    const { id, created_at, updated_at, ...rest } = original;
    return this.prisma.ztteam_templates.create({
      data: {
        ...rest as any,
        name: `${original.name} (Bản sao)`,
        fb_page_id: pageId,
        is_default: false,
      }
    });
  }

  async ztteam_updateTemplate(id: string, data: any) {
    return this.prisma.ztteam_templates.update({ where: { id }, data });
  }

  async ztteam_deleteTemplate(id: string) {
    return this.prisma.ztteam_templates.delete({ where: { id } });
  }

  async ztteam_duplicateTemplate(id: string) {
    const original = await this.ztteam_getTemplate(id);
    if (!original) throw new Error('Template not found');

    const { id: _, created_at, updated_at, ...copyData } = original;
    return this.prisma.ztteam_templates.create({
      data: {
        ...copyData,
        name: `${copyData.name} (Copy)`,
        layout: copyData.layout as any,
        is_default: false
      }
    });
  }
}
