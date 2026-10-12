import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ZTTeamAnalyticsService {
  private readonly logger = new Logger(ZTTeamAnalyticsService.name);
  private analyticsClient: BetaAnalyticsDataClient | null = null;
  private clientInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * ZTTeam: Lấy hoặc khởi tạo Google Analytics Data Client từ cơ sở dữ liệu hoặc biến môi trường
   */
  async ztteam_getClient(): Promise<BetaAnalyticsDataClient | null> {
    if (this.analyticsClient && this.clientInitialized) {
      return this.analyticsClient;
    }

    try {
      /** 1. Thử lấy từ cơ sở dữ liệu bảng ztteam_system_settings */
      const setting = await this.prisma.ztteam_system_settings.findUnique({
        where: { key: 'ga4_service_account_json' },
      });

      let credentialsJson = setting?.value;

      /** 2. Nếu không có trong DB, kiểm tra biến môi trường process.env.GA4_CREDENTIALS_JSON */
      if (!credentialsJson && process.env.GA4_CREDENTIALS_JSON) {
        credentialsJson = process.env.GA4_CREDENTIALS_JSON;
      }

      if (!credentialsJson) {
        this.logger.warn('Chưa có cấu hình Google Analytics Service Account JSON.');
        return null;
      }

      const credentials = typeof credentialsJson === 'string' ? JSON.parse(credentialsJson) : credentialsJson;

      this.analyticsClient = new BetaAnalyticsDataClient({
        credentials,
      });
      this.clientInitialized = true;
      return this.analyticsClient;
    } catch (error: any) {
      this.logger.error(`Lỗi khởi tạo Google Analytics Client: ${error.message}`);
      return null;
    }
  }

  /**
   * ZTTeam: Lấy thông tin cấu hình hiện tại (Bao gồm cả credentialsJson để hiển thị bền vững trong UI)
   */
  async ztteam_getConfig() {
    const setting = await this.prisma.ztteam_system_settings.findUnique({
      where: { key: 'ga4_service_account_json' },
    });

    const defaultPropertySetting = await this.prisma.ztteam_system_settings.findUnique({
      where: { key: 'ga4_default_property_id' },
    });

    const monitoredSitesSetting = await this.prisma.ztteam_system_settings.findUnique({
      where: { key: 'ga4_monitored_sites' },
    });

    let clientEmail = '';
    let projectId = '';
    let hasCredentials = false;
    let credentialsJson = setting?.value || '';

    if (credentialsJson) {
      try {
        const creds = JSON.parse(credentialsJson);
        clientEmail = creds.client_email || '';
        projectId = creds.project_id || '';
        hasCredentials = true;
      } catch (e) {
        /** Bỏ qua */
      }
    } else if (process.env.GA4_CREDENTIALS_JSON) {
      credentialsJson = process.env.GA4_CREDENTIALS_JSON;
      try {
        const creds = JSON.parse(credentialsJson);
        clientEmail = creds.client_email || '';
        projectId = creds.project_id || '';
        hasCredentials = true;
      } catch (e) {
        /** Bỏ qua */
      }
    }

    let monitoredSites: Array<{ id: string; name: string; domain: string; propertyId: string; active: boolean }> = [];
    if (monitoredSitesSetting?.value) {
      try {
        monitoredSites = JSON.parse(monitoredSitesSetting.value);
      } catch (e) {
        monitoredSites = [];
      }
    }

    const defaultPropertyId = defaultPropertySetting?.value || process.env.GA4_DEFAULT_PROPERTY_ID || (monitoredSites[0]?.propertyId || '');

    /** Khởi tạo mặc định nếu chưa có cấu hình danh sách site */
    if (monitoredSites.length === 0 && defaultPropertyId) {
      monitoredSites = [
        {
          id: 'site_1',
          name: 'thieponline.store',
          domain: 'thieponline.store',
          propertyId: defaultPropertyId,
          active: true,
        },
      ];
    }

    return {
      hasCredentials,
      credentialsJson,
      clientEmail,
      projectId,
      defaultPropertyId,
      monitoredSites,
    };
  }

  /**
   * ZTTeam: Lưu cấu hình Service Account JSON, Default Property ID và danh sách Monitored Sites
   */
  async ztteam_saveConfig(
    credentialsJson?: string,
    defaultPropertyId?: string,
    monitoredSites?: Array<{ id: string; name: string; domain: string; propertyId: string; active: boolean }>
  ) {
    if (credentialsJson && credentialsJson.trim()) {
      try {
        const parsed = JSON.parse(credentialsJson.trim());
        if (!parsed.client_email || !parsed.private_key) {
          throw new BadRequestException('File JSON không hợp lệ. Phải chứa client_email và private_key của Google Cloud.');
        }
      } catch (err: any) {
        throw new BadRequestException(`Định dạng JSON không hợp lệ: ${err.message}`);
      }

      /** Lưu vào cơ sở dữ liệu */
      await this.prisma.ztteam_system_settings.upsert({
        where: { key: 'ga4_service_account_json' },
        create: { key: 'ga4_service_account_json', value: credentialsJson.trim() },
        update: { value: credentialsJson.trim() },
      });

      /** Xóa cache client để khởi tạo lại với thông tin mới */
      this.analyticsClient = null;
      this.clientInitialized = false;
    }

    if (defaultPropertyId !== undefined) {
      await this.prisma.ztteam_system_settings.upsert({
        where: { key: 'ga4_default_property_id' },
        create: { key: 'ga4_default_property_id', value: defaultPropertyId.trim() },
        update: { value: defaultPropertyId.trim() },
      });
    }

    if (monitoredSites !== undefined && Array.isArray(monitoredSites)) {
      await this.prisma.ztteam_system_settings.upsert({
        where: { key: 'ga4_monitored_sites' },
        create: { key: 'ga4_monitored_sites', value: JSON.stringify(monitoredSites) },
        update: { value: JSON.stringify(monitoredSites) },
      });
    }

    return {
      success: true,
      message: 'Đã lưu cấu hình Google Analytics thành công!',
    };
  }

  /**
   * ZTTeam: Kiểm tra kết nối trực tiếp với GA4 Property
   */
  async ztteam_testConnection(propertyId?: string) {
    const config = await this.ztteam_getConfig();
    const targetPropertyId = (propertyId || config.defaultPropertyId || '').trim();

    if (!targetPropertyId) {
      throw new BadRequestException('Vui lòng cung cấp GA4 Property ID để kiểm tra kết nối.');
    }

    const client = await this.ztteam_getClient();
    if (!client) {
      throw new BadRequestException('Chưa cấu hình Service Account JSON hoặc JSON không hợp lệ.');
    }

    try {
      const [response] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        metrics: [{ name: 'activeUsers' }],
      });

      const activeUsers = parseInt(response.rows?.[0]?.metricValues?.[0]?.value || '0', 10);

      return {
        success: true,
        propertyId: targetPropertyId,
        activeUsers,
        message: `Kết nối GA4 thành công! Hiện có ${activeUsers} người dùng đang online.`,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi kiểm tra kết nối GA4 Property #${targetPropertyId}: ${error.message}`);
      throw new BadRequestException(`Lỗi kết nối GA4: ${error.message}`);
    }
  }

  /**
   * ZTTeam: Lấy dữ liệu Realtime chi tiết (active users, top pages, countries, campaigns)
   */
  async ztteam_getRealtimeStats(siteId?: string, customPropertyId?: string) {
    let targetPropertyId = (customPropertyId || '').trim();
    let siteUrl = '';

    /** Nếu có siteId, tìm propertyId gắn với website đó */
    if (siteId && !targetPropertyId) {
      const site = await this.prisma.ztteam_target_sites.findUnique({
        where: { id: siteId },
      });
      if (site) {
        siteUrl = site.wp_url;
        targetPropertyId = site.ga4_property_id || '';
      }
    }

    /** Fallback về defaultPropertyId */
    if (!targetPropertyId) {
      const config = await this.ztteam_getConfig();
      targetPropertyId = config.defaultPropertyId;
    }

    if (!targetPropertyId) {
      return {
        configured: false,
        message: 'Chưa cấu hình GA4 Property ID.',
        activeUsers: 0,
        topPages: [],
        topCountries: [],
        topCampaigns: [],
        minuteTrend: [],
      };
    }

    const client = await this.ztteam_getClient();
    if (!client) {
      return {
        configured: false,
        message: 'Chưa cấu hình Service Account JSON.',
        activeUsers: 0,
        topPages: [],
        topCountries: [],
        topCampaigns: [],
        minuteTrend: [],
      };
    }

    let activeUsers = 0;
    let pageViews = 0;
    let topPages: any[] = [];
    let topCountries: any[] = [];
    let topCities: any[] = [];
    let topDevices: any[] = [];
    let minuteTrend: any[] = [];

    /** 1. Gọi Report tổng số người online & lượt xem */
    try {
      const [overviewRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      });
      activeUsers = parseInt(overviewRes.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
      pageViews = parseInt(overviewRes.rows?.[0]?.metricValues?.[1]?.value || '0', 10);
    } catch (err: any) {
      this.logger.warn(`Overview report failed for #${targetPropertyId}: ${err.message}`);
    }

    /** 2. Gọi Report Top Bài Viết đang online (unifiedScreenName là dimension chuẩn) */
    try {
      const [pagesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'unifiedScreenName' }],
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15,
      });

      topPages = (pagesRes.rows || []).map(row => ({
        title: row.dimensionValues?.[0]?.value || 'Trang chủ',
        pagePath: '',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
        pageViews: parseInt(row.metricValues?.[1]?.value || '0', 10),
      }));
    } catch (err: any) {
      this.logger.warn(`Pages report failed for #${targetPropertyId}: ${err.message}`);
    }

    /** 3. Gọi Report Top Quốc Gia */
    try {
      const [countriesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      });

      topCountries = (countriesRes.rows || []).map(row => ({
        country: row.dimensionValues?.[0]?.value || 'Unknown',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));
    } catch (err: any) {
      this.logger.warn(`Countries report failed for #${targetPropertyId}: ${err.message}`);
    }

    /** 4. Gọi Report Top Thành Phố (Khu vực truy cập) */
    try {
      const [citiesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      });

      topCities = (citiesRes.rows || []).map(row => ({
        city: row.dimensionValues?.[0]?.value || 'Unknown',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));
    } catch (err: any) {
      this.logger.warn(`Cities report failed for #${targetPropertyId}: ${err.message}`);
    }

    /** 5. Gọi Report Thiết Bị Truy Cập (Mobile / Desktop) */
    try {
      const [devicesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 5,
      });

      topDevices = (devicesRes.rows || []).map(row => ({
        device: row.dimensionValues?.[0]?.value || 'Desktop',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));
    } catch (err: any) {
      this.logger.warn(`Devices report failed for #${targetPropertyId}: ${err.message}`);
    }

    /** 6. Gọi Report biểu đồ người dùng theo từng phút (minutesAgo) */
    try {
      const [minutesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'minutesAgo' }, desc: false }],
        limit: 30,
      });

      minuteTrend = (minutesRes.rows || []).map(row => ({
        minutesAgo: parseInt(row.dimensionValues?.[0]?.value || '0', 10),
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));
    } catch (err: any) {
      this.logger.warn(`Minutes report failed for #${targetPropertyId}: ${err.message}`);
    }

    return {
      configured: true,
      propertyId: targetPropertyId,
      siteUrl,
      activeUsers,
      pageViews,
      topPages,
      topCountries,
      topCities,
      topDevices,
      topCampaigns: topCities.map(c => ({ campaign: c.city, source: 'Thành phố', activeUsers: c.activeUsers })),
      minuteTrend,
      updatedAt: new Date(),
    };
  }

  /**
   * ZTTeam: Lấy dữ liệu Realtime đồng thời cho tất cả các website được giám sát (Multi-site)
   */
  async ztteam_getAllRealtimeStats() {
    const config = await this.ztteam_getConfig();
    const client = await this.ztteam_getClient();

    if (!client || !config.hasCredentials) {
      return {
        configured: false,
        totalActiveUsers: 0,
        sites: [],
        message: 'Chưa cấu hình Google Analytics Service Account JSON.',
      };
    }

    const sitesToQuery = (config.monitoredSites || []).filter(s => s.active && s.propertyId?.trim());

    if (sitesToQuery.length === 0) {
      return {
        configured: true,
        totalActiveUsers: 0,
        sites: [],
        message: 'Chưa có website nào được bật theo dõi hoặc thiếu Property ID.',
      };
    }

    /** Truy vấn song song cho tất cả các site */
    const results = await Promise.allSettled(
      sitesToQuery.map(async (site) => {
        const propId = site.propertyId.trim();
        let activeUsers = 0;
        let topArticles: Array<{ title: string; activeUsers: number }> = [];
        let topCountries: Array<{ country: string; activeUsers: number }> = [];

        try {
          /** 1. Lấy tổng số user online */
          const [overviewRes] = await client.runRealtimeReport({
            property: `properties/${propId}`,
            metrics: [{ name: 'activeUsers' }],
          });
          activeUsers = parseInt(overviewRes.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
        } catch (err: any) {
          this.logger.warn(`Lỗi lấy activeUsers cho ${site.domain} (#${propId}): ${err.message}`);
        }

        try {
          /** 2. Lấy top bài viết đang đọc (unifiedScreenName) */
          const [pagesRes] = await client.runRealtimeReport({
            property: `properties/${propId}`,
            dimensions: [{ name: 'unifiedScreenName' }],
            metrics: [{ name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 6,
          });

          topArticles = (pagesRes.rows || []).map(r => ({
            title: r.dimensionValues?.[0]?.value || 'Trang chủ',
            activeUsers: parseInt(r.metricValues?.[0]?.value || '0', 10),
          }));
        } catch (err: any) {
          this.logger.warn(`Lỗi lấy topArticles cho ${site.domain} (#${propId}): ${err.message}`);
        }

        try {
          /** 3. Lấy top quốc gia */
          const [countriesRes] = await client.runRealtimeReport({
            property: `properties/${propId}`,
            dimensions: [{ name: 'country' }],
            metrics: [{ name: 'activeUsers' }],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
            limit: 5,
          });

          topCountries = (countriesRes.rows || []).map(r => ({
            country: r.dimensionValues?.[0]?.value || 'Không xác định',
            activeUsers: parseInt(r.metricValues?.[0]?.value || '0', 10),
          }));
        } catch (err: any) {
          this.logger.warn(`Lỗi lấy topCountries cho ${site.domain} (#${propId}): ${err.message}`);
        }

        return {
          id: site.id,
          name: site.name,
          domain: site.domain,
          propertyId: propId,
          activeUsers,
          topArticles,
          topCountries,
          ga4Url: `https://analytics.google.com/analytics/web/#/p${propId}/realtime/overview`,
        };
      })
    );

    const siteStats = results.map((res, idx) => {
      if (res.status === 'fulfilled') {
        return res.value;
      } else {
        const site = sitesToQuery[idx];
        return {
          id: site.id,
          name: site.name,
          domain: site.domain,
          propertyId: site.propertyId,
          activeUsers: 0,
          topArticles: [],
          topCountries: [],
          ga4Url: `https://analytics.google.com/analytics/web/#/p${site.propertyId}/realtime/overview`,
          error: res.reason?.message || 'Lỗi truy vấn',
        };
      }
    });

    const totalActiveUsers = siteStats.reduce((sum, s) => sum + (s.activeUsers || 0), 0);

    return {
      configured: true,
      totalActiveUsers,
      sites: siteStats,
      updatedAt: new Date(),
    };
  }
}
