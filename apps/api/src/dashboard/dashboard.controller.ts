import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ZTTeamDashboardService } from './dashboard.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('dashboard')
@UseGuards(ZTTeamAuthGuard)
export class ZTTeamDashboardController {
  constructor(private readonly dashboardService: ZTTeamDashboardService) {}

  @Get('stats')
  async ztteam_getStats(
    @Request() req: any,
    @Query('pageId') pageId?: string,
    @Query('siteId') siteId?: string,
    @Query('targetUserId') targetUserId?: string
  ) {
    return this.dashboardService.ztteam_getStats(req.user.sub, pageId, siteId, targetUserId);
  }

  @Get('chart')
  async ztteam_getChartData(
    @Request() req: any, 
    @Query('days') days?: string,
    @Query('pageId') pageId?: string,
    @Query('siteId') siteId?: string,
    @Query('targetUserId') targetUserId?: string
  ) {
    const daysInt = parseInt(days || '7', 10);
    return this.dashboardService.ztteam_getChartData(req.user.sub, daysInt, pageId, siteId, targetUserId);
  }
}
