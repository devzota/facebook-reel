import { Module } from '@nestjs/common';
import { ZTTeamWordpressController } from './wordpress.controller';
import { ZTTeamWordpressService } from './wordpress.service';
import { ZTTeamHtmlCleanerService } from './html-cleaner.service';
import { PrismaModule } from '../prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [PrismaModule, HttpModule],
  controllers: [ZTTeamWordpressController],
  providers: [ZTTeamWordpressService, ZTTeamHtmlCleanerService],
  exports: [ZTTeamWordpressService]
})
export class ZTTeamWordpressModule {}
