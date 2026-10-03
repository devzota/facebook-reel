import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import { ztteam_ensureStorageDirs, ztteam_getStorageRoot, ztteam_getImagesPath, ztteam_getTemplatesPath } from './common/ztteam_storage.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();

  /** Ensure all storage directories exist */
  ztteam_ensureStorageDirs();

  const storageRoot = ztteam_getStorageRoot();

  /** Serve storage static assets with /storage/ prefix */
  app.useStaticAssets(storageRoot, {
    prefix: '/storage/',
  });

  /** Also serve legacy /images/ and /templates/ directly if referenced without /storage/ */
  app.useStaticAssets(ztteam_getImagesPath(), {
    prefix: '/images/',
  });
  app.useStaticAssets(ztteam_getTemplatesPath(), {
    prefix: '/templates/',
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();

