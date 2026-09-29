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

export function contentHubApiBase(url: string): string {
  const origin = url.replace(/\/$/, '').replace(/\/api(\/(public|admin))?$/, '');
  return `${origin}/api`;
}

/** Same-origin only. Node fetch drops Authorization on any redirect. */
export function sameOriginRedirect(fromUrl: string, location: string | null): string | null {
  if (!location) return null;
  const next = new URL(location, fromUrl);
  if (next.origin !== new URL(fromUrl).origin) return null;
  return next.toString();
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
    if (input.windowStart) params.set('windowStart', input.windowStart);
    if (input.windowEnd) params.set('windowEnd', input.windowEnd);
    for (const source of input.sources ?? []) {
      params.append('sources', source);
    }
    const qs = params.toString();
    const url = `${contentHubApiBase(this.env.contentHubBaseUrl)}/campaigns/${input.campaignId}/report-packet${qs ? `?${qs}` : ''}`;

    const requestId = input.requestId || randomUUID();
    let response = await this.get(url, requestId);
    if (response.status === 401) {
      const peek = await response.clone().text();
      // Hub "Missing bearer token" means the Authorization header never
      // arrived (redirect strip, proxy). A new Cognito token will not help.
      if (!/missing bearer token/i.test(peek)) {
        this.tokens.invalidate();
        response = await this.get(url, requestId);
      }
    }

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Content Hub report-packet failed (${response.status}) campaign=${input.campaignId} url=${url} ${body.slice(0, 200)}`,
      );
      throw new ContentHubClientError(`Content Hub returned ${response.status}: ${body}`);
    }

    return (await response.json()) as ReportInputPacket;
  }

  private async get(url: string, requestId: string): Promise<Response> {
    const token = await this.tokens.getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Client': 'cht-reports',
      'X-Request-Id': requestId,
    };
    this.logger.log(`report-packet GET ${url} bearerLen=${token.length} requestId=${requestId}`);

    let response = await fetch(url, { method: 'GET', redirect: 'manual', headers });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      const next = sameOriginRedirect(url, location);
      this.logger.warn(`report-packet HTTP ${response.status} redirect location=${location} follow=${next ?? 'rejected'}`);
      if (!next) {
        throw new ContentHubClientError(`Content Hub redirected to ${location ?? '(none)'}`);
      }
      response = await fetch(next, { method: 'GET', redirect: 'manual', headers });
    }
    return response;
  }
}