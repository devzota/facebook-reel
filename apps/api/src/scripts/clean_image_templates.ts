import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  const result = await prisma.ztteam_templates.deleteMany({
    where: { format: 'image' }
  });
  console.log('Deleted image templates:', result.count);
}
clean().then(() => prisma.$disconnect());
