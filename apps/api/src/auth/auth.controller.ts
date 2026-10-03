import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ZTTeamAuthService } from './auth.service';

@Controller('auth')
export class ZTTeamAuthController {
  constructor(private authService: ZTTeamAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  ztteam_login(@Body() signInDto: Record<string, any>) {
    return this.authService.ztteam_login(signInDto.email, signInDto.password);
  }
}
