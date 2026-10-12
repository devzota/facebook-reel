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
   * ZTTeam: Lấy thông tin cấu hình hiện tại (Ẩn private_key để bảo mật)
   */
  async ztteam_getConfig() {
    const setting = await this.prisma.ztteam_system_settings.findUnique({
      where: { key: 'ga4_service_account_json' },
    });

    const defaultPropertySetting = await this.prisma.ztteam_system_settings.findUnique({
      where: { key: 'ga4_default_property_id' },
    });

    let clientEmail = '';
    let projectId = '';
    let hasCredentials = false;

    if (setting?.value) {
      try {
        const creds = JSON.parse(setting.value);
        clientEmail = creds.client_email || '';
        projectId = creds.project_id || '';
        hasCredentials = true;
      } catch (e) {
        /** Bỏ qua */
      }
    } else if (process.env.GA4_CREDENTIALS_JSON) {
      try {
        const creds = JSON.parse(process.env.GA4_CREDENTIALS_JSON);
        clientEmail = creds.client_email || '';
        projectId = creds.project_id || '';
        hasCredentials = true;
      } catch (e) {
        /** Bỏ qua */
      }
    }

    return {
      hasCredentials,
      clientEmail,
      projectId,
      defaultPropertyId: defaultPropertySetting?.value || process.env.GA4_DEFAULT_PROPERTY_ID || '',
    };
  }

  /**
   * ZTTeam: Lưu cấu hình Service Account JSON và Default Property ID vào cơ sở dữ liệu
   */
  async ztteam_saveConfig(credentialsJson: string, defaultPropertyId?: string) {
    if (!credentialsJson || !credentialsJson.trim()) {
      throw new BadRequestException('Nội dung file JSON Service Account không được để trống.');
    }

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

    if (defaultPropertyId) {
      await this.prisma.ztteam_system_settings.upsert({
        where: { key: 'ga4_default_property_id' },
        create: { key: 'ga4_default_property_id', value: defaultPropertyId.trim() },
        update: { value: defaultPropertyId.trim() },
      });
    }

    /** Xóa cache client để khởi tạo lại với thông tin mới */
    this.analyticsClient = null;
    this.clientInitialized = false;

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

    try {
      /** 1. Gọi Report tổng số người online */
      const [overviewRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
      });

      const activeUsers = parseInt(overviewRes.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
      const pageViews = parseInt(overviewRes.rows?.[0]?.metricValues?.[1]?.value || '0', 10);

      /** 2. Gọi Report Top Pages đang online */
      const [pagesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'unifiedScreenName' }, { name: 'pagePath' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 15,
      });

      const topPages = (pagesRes.rows || []).map(row => ({
        title: row.dimensionValues?.[0]?.value || 'Trang chủ',
        pagePath: row.dimensionValues?.[1]?.value || '/',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));

      /** 3. Gọi Report Top Quốc Gia */
      const [countriesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 8,
      });

      const topCountries = (countriesRes.rows || []).map(row => ({
        country: row.dimensionValues?.[0]?.value || 'Unknown',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));

      /** 4. Gọi Report Nguồn Campaign / Fanpage kéo traffic */
      const [campaignsRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'sessionCampaignName' }, { name: 'sessionSource' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 10,
      });

      const topCampaigns = (campaignsRes.rows || []).map(row => ({
        campaign: row.dimensionValues?.[0]?.value || '(not set)',
        source: row.dimensionValues?.[1]?.value || '(direct)',
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));

      /** 5. Gọi Report biểu đồ người dùng theo từng phút (minutesAgo) */
      const [minutesRes] = await client.runRealtimeReport({
        property: `properties/${targetPropertyId}`,
        dimensions: [{ name: 'minutesAgo' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ dimension: { dimensionName: 'minutesAgo' }, desc: false }],
        limit: 30,
      });

      const minuteTrend = (minutesRes.rows || []).map(row => ({
        minutesAgo: parseInt(row.dimensionValues?.[0]?.value || '0', 10),
        activeUsers: parseInt(row.metricValues?.[0]?.value || '0', 10),
      }));

      return {
        configured: true,
        propertyId: targetPropertyId,
        siteUrl,
        activeUsers,
        pageViews,
        topPages,
        topCountries,
        topCampaigns,
        minuteTrend,
        updatedAt: new Date(),
      };
    } catch (error: any) {
      this.logger.error(`Lỗi lấy dữ liệu Realtime GA4 #${targetPropertyId}: ${error.message}`);
      return {
        configured: true,
        error: error.message,
        activeUsers: 0,
        topPages: [],
        topCountries: [],
        topCampaigns: [],
        minuteTrend: [],
      };
    }
  }
}
