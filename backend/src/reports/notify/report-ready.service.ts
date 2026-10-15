/**
 * Tell cht-platform-tool a report version is ready, so Platform emails the
 * report's notify list (CPR-35). Platform owns recipients, branding and SES;
 * this is one M2M call (platform/reports.notify) after the job is complete.
 *
 * Best effort: the report is already complete and downloadable when this
 * runs, so a failed notification is logged and never fails the job.
 * Platform records which version it emailed, so a retried call cannot
 * double-send.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';

export interface ReportReadyMessage {
  requestId: string;
  campaignId: string;
  version: number;
}

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1_000;

@Injectable()
export class ReportReadyNotifier {
  private readonly logger = new Logger(ReportReadyNotifier.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly tokens: CognitoM2mTokenService,
  ) {}

  /** Returns true when Platform accepted the notification. Never throws. */
  async notify(message: ReportReadyMessage): Promise<boolean> {
    const base = this.env.platformBaseUrl;
    if (!base) {
      this.logger.warn(`Report ${message.requestId} v${message.version}: PLATFORM_BASE_URL not set, skipping notify`);
      return false;
    }

    const scope = this.env.platformNotifyScope;
    const url = `${base}/internal/reports/${encodeURIComponent(message.requestId)}/ready`;
    const body = JSON.stringify({ campaignId: message.campaignId, version: message.version });

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let status: number | null = null;
      let detail = '';
      try {
        const token = await this.tokens.getAccessToken(scope);
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'manual',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Client': 'cht-reports',
            'X-Request-Id': message.requestId,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        status = response.status;
        if (response.ok) {
          this.logger.log(`Report ${message.requestId} v${message.version}: Platform notified (${status})`);
          return true;
        }
        detail = (await response.text().catch(() => '')).slice(0, 200);
      } catch (err) {
        detail = err instanceof Error ? err.message : String(err);
      }

      // A 401 can be a stale cached token; anything else 4xx will not change on retry.
      if (status === 401) {
        this.tokens.invalidate(scope);
      } else if (status !== null && status >= 400 && status < 500) {
        this.logger.error(
          `Report ${message.requestId} v${message.version}: Platform rejected notify (${status}) ${detail}`,
        );
        return false;
      }

      this.logger.warn(
        `Report ${message.requestId} v${message.version}: notify attempt ${attempt}/${MAX_ATTEMPTS} failed (${status ?? 'network'}) ${detail}`,
      );
      if (attempt < MAX_ATTEMPTS) {
        await this.delay(RETRY_DELAY_MS * attempt);
      }
    }

    this.logger.error(`Report ${message.requestId} v${message.version}: Platform not notified after ${MAX_ATTEMPTS} attempts`);
    return false;
  }

  /** Separate so tests can skip the wait. */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
