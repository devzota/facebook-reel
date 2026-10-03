import { Module } from '@nestjs/common';
import { ZTTeamAuthService } from './auth.service';
import { ZTTeamAuthController } from './auth.controller';
import { ZTTeamUsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ZTTeamUsersModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'ZTREEL_SECRET_KEY_2026',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [ZTTeamAuthService],
  controllers: [ZTTeamAuthController],
  exports: [ZTTeamAuthService],
})
export class ZTTeamAuthModule {}
