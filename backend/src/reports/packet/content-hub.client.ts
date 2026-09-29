/**
 * Fetch the generate-time input packet from Content Hub.
 * Hub owns warehouse SQL; this client is HTTPS + Cognito M2M Bearer
 * (hub/reports.read) only. Hub rejects X-API-Key since cht-content-hub #153.
 *
 * CONTENTHUB_BASE_URL may be origin, `/api`, `/api/public`, or `/api/admin`.
 * The packet route is `/api/campaigns/{id}/report-packet`, outside both.
 */

import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';
import type { FetchReportPacketInput, ReportInputPacket } from './report-packet.types';

export class ContentHubClientError extends Error {}

/**
 * Hub types windowStart/windowEnd as dates and answers 422
 * (date_from_datetime_inexact) to a full ISO timestamp, which is what
 * the platform writes on the job row. Send the UTC calendar date.
 */
export function toHubDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}

export function contentHubApiBase(url: string): string {
  const origin = url.replace(/\/$/, '').replace(/\/api(\/(public|admin))?$/, '');
  return `${origin}/api`;
}

@Injectable()
export class ContentHubClient {
  private readonly logger = new Logger(ContentHubClient.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly tokens: CognitoM2mTokenService,
  ) {}

  async fetchReportPacket(input: FetchReportPacketInput): Promise<ReportInputPacket> {
    const params = new URLSearchParams();
    if (input.windowStart) params.set('windowStart', toHubDate(input.windowStart));
    if (input.windowEnd) params.set('windowEnd', toHubDate(input.windowEnd));
    for (const source of input.sources ?? []) {
      params.append('sources', source);
    }
    const qs = params.toString();
    const url = `${contentHubApiBase(this.env.contentHubBaseUrl)}/campaigns/${input.campaignId}/report-packet${qs ? `?${qs}` : ''}`;

    const requestId = randomUUID();
    let response = await this.get(url, requestId);
    if (response.status === 401) {
      // Token revoked or expired early: mint a fresh one and retry once.
      this.tokens.invalidate();
      response = await this.get(url, requestId);
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Content Hub report-packet failed (${response.status}) campaign=${input.campaignId}`);
      throw new ContentHubClientError(`Content Hub returned ${response.status}: ${body}`);
    }

    return (await response.json()) as ReportInputPacket;
  }

  private async get(url: string, requestId: string): Promise<Response> {
    const token = await this.tokens.getAccessToken();
    return fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Client': 'cht-reports',
        'X-Request-Id': requestId,
      },
    });
  }
}