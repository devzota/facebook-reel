import { Module } from '@nestjs/common';
import { ZTTeamAIService } from './ai.service';
import { ZTTeamAIController } from './ai.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ZTTeamAIController],
  providers: [ZTTeamAIService],
  exports: [ZTTeamAIService],
})
export class ZTTeamAIModule {}
