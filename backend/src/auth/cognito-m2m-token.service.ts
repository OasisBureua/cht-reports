import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

type CachedToken = {
  accessToken: string;
  /** Epoch ms when we should refresh (before Cognito expiry). */
  refreshAtMs: number;
};

export class CognitoM2mTokenError extends Error {}

/**
 * In-memory Cognito client_credentials cache for cht-reports -> Content Hub
 * (hub/reports.read). Same pattern as cht-platform-tool's
 * CognitoM2mTokenService: warm on boot, reuse until ~60s before expiry, one
 * in-flight request shared by concurrent callers.
 *
 * Credentials come from the cht-{env}-cognito-m2m-reports secret (Hub TF),
 * injected by ECS as CONTENTHUB_M2M_* env vars.
 *
 * Logging policy: success and failure outcomes are OK to log.
 * Never log access_token, client_secret, or Authorization headers.
 */
@Injectable()
export class CognitoM2mTokenService implements OnModuleInit {
  private readonly logger = new Logger(CognitoM2mTokenService.name);
  private cache: CachedToken | null = null;
  private inflight: Promise<string> | null = null;

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async onModuleInit(): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn('[M2M] Reports->Hub token warm skipped (CONTENTHUB_M2M_* not configured)');
      return;
    }
    try {
      await this.getAccessToken();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`[M2M] Reports->Hub token warm failed: ${message} (Hub calls will retry on demand)`);
    }
  }

  isConfigured(): boolean {
    const m2m = this.env.contentHubM2m;
    return !!(m2m.clientId && m2m.clientSecret && m2m.tokenUrl && m2m.scope);
  }

  /**
   * Bearer access token for Hub. Served from cache until ~60s before expiry.
   * Throws CognitoM2mTokenError when M2M is not configured or the mint fails.
   */
  async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new CognitoM2mTokenError('Content Hub M2M is not configured (missing CONTENTHUB_M2M_* credentials)');
    }

    if (this.cache && this.cache.refreshAtMs > Date.now()) {
      return this.cache.accessToken;
    }

    if (this.inflight) {
      return this.inflight;
    }

    this.inflight = this.fetchAndCache().finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  /** Drop the cached token, e.g. after Hub answers 401 to it. */
  invalidate(): void {
    this.cache = null;
  }

  private async fetchAndCache(): Promise<string> {
    const { clientId, clientSecret, tokenUrl, scope } = this.env.contentHubM2m;

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const body = new URLSearchParams({ grant_type: 'client_credentials', scope });

    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[M2M] token fetch network error: ${message}`);
      throw new CognitoM2mTokenError('Unable to obtain Content Hub M2M token');
    }

    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !json.access_token) {
      this.logger.warn(
        `[M2M] token fetch failed status=${res.status} error=${json.error || ''} ${json.error_description || ''}`,
      );
      throw new CognitoM2mTokenError('Content Hub M2M token request was rejected');
    }

    const expiresInSec =
      typeof json.expires_in === 'number' && json.expires_in > 120 ? json.expires_in : 3600;
    // Refresh 60s before expiry (floor at 30s lifetime).
    const refreshAtMs = Date.now() + Math.max(expiresInSec - 60, 30) * 1000;

    this.cache = { accessToken: json.access_token, refreshAtMs };
    this.logger.log(
      `[M2M] Reports->Hub token successfully loaded clientId=${clientId} scopes=${scope} expiresIn=${expiresInSec}s`,
    );
    return json.access_token;
  }
}
