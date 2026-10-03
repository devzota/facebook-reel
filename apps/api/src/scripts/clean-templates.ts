import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://root:rootpassword@localhost:5432/ztreel?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting template cleanup and text fix...');
  const templates = await prisma.ztteam_templates.findMany({
    where: { format: 'video' }
  });

  let updatedCount = 0;

  for (const t of templates) {
    let html = t.html_content;
    if (!html) continue;

    html = html.replace(/<div class="breaking">.*?<\/div>/g, '');
    html = html.replace(/<div class="panel"><\/div>/g, '');
    html = html.replace(/<div class="card"><\/div>/g, '');


    html = html.replace(/Khu[^<]*\(Subtitles\)/g, 'Khu vực phụ đề (Subtitles)');
    html = html.replace(/M.*U N.*I DUNG DEMO/g, 'MẪU NỘI DUNG DEMO');

    if (html !== t.html_content) {
      await prisma.ztteam_templates.update({
        where: { id: t.id },
        data: { html_content: html }
      });
      updatedCount++;
      console.log(`Updated template: ${t.name} (ID: ${t.id})`);
    }
  }

  console.log(`Cleanup complete! Updated ${updatedCount} templates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
