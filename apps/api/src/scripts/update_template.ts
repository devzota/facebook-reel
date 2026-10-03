import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function run() {
  const html = fs.readFileSync('../../yeucau2.md', 'utf8');
  
  const layout = {
    hook: { x: 40, y: 1450 },
    header: { x: 40, y: 40 },
    breaking: { x: 40, y: 1310 },
    subtitles: { x: 40, y: 1550 }
  };

  const res = await prisma.ztteam_templates.update({
    where: { id: 'cms7gju870000a0w784w6piia' },
    data: {
      html_content: html,
      layout: layout
    }
  });
  
  console.log('Updated:', res.id);
}

run().catch(console.error);
