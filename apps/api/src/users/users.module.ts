import { Module } from '@nestjs/common';
import { ZTTeamUsersService } from './users.service';
import { ZTTeamUsersController } from './users.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ZTTeamUsersController],
  providers: [ZTTeamUsersService],
  exports: [ZTTeamUsersService],
})
export class ZTTeamUsersModule {}
