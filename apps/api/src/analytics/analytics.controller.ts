import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ZTTeamAnalyticsService } from './analytics.service';
import { ZTTeamAuthGuard } from '../auth/auth.guard';

@Controller('analytics')
@UseGuards(ZTTeamAuthGuard)
export class ZTTeamAnalyticsController {
  constructor(private readonly analyticsService: ZTTeamAnalyticsService) {}

  /**
   * ZTTeam: Lấy trạng thái cấu hình GA4 hiện tại
   * GET /api/analytics/config
   */
  @Get('config')
  async ztteam_getConfig() {
    return this.analyticsService.ztteam_getConfig();
  }

  /**
   * ZTTeam: Lưu cấu hình Service Account JSON, Default Property ID & Monitored Sites
   * POST /api/analytics/config
   */
  @Post('config')
  async ztteam_saveConfig(
    @Body() body: {
      credentialsJson?: string;
      defaultPropertyId?: string;
      monitoredSites?: Array<{ id: string; name: string; domain: string; propertyId: string; active: boolean }>;
    }
  ) {
    return this.analyticsService.ztteam_saveConfig(
      body.credentialsJson,
      body.defaultPropertyId,
      body.monitoredSites
    );
  }

  /**
   * ZTTeam: Kiểm tra kết nối thử nghiệm với GA4
   * POST /api/analytics/test
   */
  @Post('test')
  async ztteam_testConnection(@Body() body: { propertyId?: string }) {
    return this.analyticsService.ztteam_testConnection(body.propertyId);
  }

  /**
   * ZTTeam: Lấy dữ liệu người dùng online theo thời gian thực đơn lẻ
   * GET /api/analytics/realtime?siteId=xxx&propertyId=xxx
   */
  @Get('realtime')
  async ztteam_getRealtime(
    @Query('siteId') siteId?: string,
    @Query('propertyId') propertyId?: string
  ) {
    return this.analyticsService.ztteam_getRealtimeStats(siteId, propertyId);
  }

  /**
   * ZTTeam: Lấy dữ liệu Realtime đa site (Multi-site) đồng thời
   * GET /api/analytics/realtime-all
   */
  @Get('realtime-all')
  async ztteam_getAllRealtime() {
    return this.analyticsService.ztteam_getAllRealtimeStats();
  }
}
