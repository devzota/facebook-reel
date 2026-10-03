import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function run() {
  const html = fs.readFileSync(path.join(__dirname, '../../../../yeucau2.md'), 'utf8');
  const res = await prisma.ztteam_templates.updateMany({
    data: {
      html_content: html
    }
  });
  console.log('Updated templates:', res.count);
}
run().catch(console.error).finally(() => prisma.$disconnect());
