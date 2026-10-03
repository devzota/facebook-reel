import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { ZTTeamUsersModule } from './users/users.module';
import { ZTTeamAuthModule } from './auth/auth.module';
import { ZTTeamFacebookModule } from './facebook/facebook.module';
import { ZTTeamCrawlerModule } from './crawler/crawler.module';
import { ZTTeamTemplatesModule } from './templates/templates.module';
import { ZTTeamAIModule } from './ai/ai.module';
import { ZTTeamAudioModule } from './audio/audio.module';
import { ZTTeamMediaModule } from './media/media.module';
import { ZTTeamRenderModule } from './render/render.module';
import { ZTTeamImageModule } from './image/image.module';
import { ZTTeamDashboardModule } from './dashboard/dashboard.module';
import { ZTTeamSettingsModule } from './settings/settings.module';
import { TelegramModule } from './telegram/telegram.module';
import { StorageModule } from './storage-cleanup/storage.module';
import { ZTTeamStoryTestModule } from './story-test/story-test.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    ZTTeamUsersModule,
    ZTTeamAuthModule,
    ZTTeamFacebookModule,
    ZTTeamCrawlerModule,
    ZTTeamTemplatesModule,
    ZTTeamAIModule,
    ZTTeamAudioModule,
    ZTTeamMediaModule,
    ZTTeamRenderModule,
    ZTTeamImageModule,
    ZTTeamDashboardModule,
    ZTTeamSettingsModule,
    TelegramModule,
    StorageModule,
    ZTTeamStoryTestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
