import { Injectable, Logger } from '@nestjs/common';

/**
 * @deprecated All auto-publishing is now unified in ZTTeamPublisherCron (apps/api/src/render/publisher.cron.ts)
 * to guarantee strict 1-post-per-slot concurrency safety and eliminate race conditions.
 */
@Injectable()
export class ZTTeamImagePublisherCron {
  private readonly logger = new Logger(ZTTeamImagePublisherCron.name);
}
