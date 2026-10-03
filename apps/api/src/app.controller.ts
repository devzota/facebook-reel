import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ZTTeamFacebookService } from './facebook/facebook.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly facebookService: ZTTeamFacebookService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
