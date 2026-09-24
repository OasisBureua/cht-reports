/**
 * Fetch the generate-time input packet from Content Hub.
 * Hub owns warehouse SQL; this client is HTTPS + X-API-Key only.
 *
 * CONTENTHUB_BASE_URL may be origin, `/api`, `/api/public`, or `/api/admin`.
 * The packet route is `/api/campaigns/{id}/report-packet`, outside both.
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import type { FetchReportPacketInput, ReportInputPacket } from './report-packet.types';

export class ContentHubClientError extends Error {}

export function contentHubApiBase(url: string): string {
  const origin = url.replace(/\/$/, '').replace(/\/api(\/(public|admin))?$/, '');
  return `${origin}/api`;
}

@Injectable()
export class ContentHubClient {
  private readonly logger = new Logger(ContentHubClient.name);

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async fetchReportPacket(input: FetchReportPacketInput): Promise<ReportInputPacket> {
    const params = new URLSearchParams();
    if (input.windowStart) params.set('windowStart', input.windowStart);
    if (input.windowEnd) params.set('windowEnd', input.windowEnd);
    for (const source of input.sources ?? []) {
      params.append('sources', source);
    }
    const qs = params.toString();
    const url = `${contentHubApiBase(this.env.contentHubBaseUrl)}/campaigns/${input.campaignId}/report-packet${qs ? `?${qs}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': this.env.contentHubApiKey,
        'X-Client': 'cht-reports',
        'X-Request-Id': randomUUID(),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Content Hub report-packet failed (${response.status}) campaign=${input.campaignId}`);
      throw new ContentHubClientError(`Content Hub returned ${response.status}: ${body}`);
    }

    return (await response.json()) as ReportInputPacket;
  }
}