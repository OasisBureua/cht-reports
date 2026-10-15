/**
 * Client for cht-companion POST /generate: a plain Bedrock completion,
 * no retrieval. Reached over Service Connect.
 *
 * Not the same endpoint /chat uses. /chat does RAG; reports assemble their
 * own Content Hub packet and need prompt-in / completion-out.
 *
 * Auth: Cognito M2M Bearer `companion/generate.invoke` (same reports client
 * as Hub / Platform notify). X-BFF-Auth is gone; companion is tokens-only.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';
import { CognitoM2mTokenService } from '../auth/cognito-m2m-token.service';

export const COMPANION_GENERATE_SCOPE = 'companion/generate.invoke';

export interface GenerateRequest {
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
  /** Spine id (SQS reportId). Sent as X-Request-Id; companion echoes it. */
  requestId?: string;
}

export interface GenerateResult {
  text: string;
  finishReason: 'complete' | 'truncated' | 'error' | 'cancelled';
  tokensInput?: number;
  tokensOutput?: number;
  requestId?: string;
}

export class CompanionGenerationError extends Error {}

interface CompanionGenerateResponse {
  text: string;
  finish_reason: GenerateResult['finishReason'];
  request_id: string;
  usage?: { input_tokens?: number | null; output_tokens?: number | null } | null;
}

interface CompanionErrorResponse {
  error: { code: string; message: string; retry_after_ms?: number };
}

@Injectable()
export class CompanionClient {
  private readonly logger = new Logger(CompanionClient.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly tokens: CognitoM2mTokenService,
  ) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const url = `${this.env.companionServiceConnectUrl}/generate`;
    const scope = this.env.companionGenerateScope;
    let response = await this.post(url, request, scope);
    if (response.status === 401) {
      this.tokens.invalidate(scope);
      response = await this.post(url, request, scope);
    }

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as CompanionErrorResponse | null;
      const message = errBody?.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(`companion /generate failed (${response.status}): ${message}`);
      throw new CompanionGenerationError(`companion /generate returned ${response.status}: ${message}`);
    }

    const body = (await response.json()) as CompanionGenerateResponse;
    if (body.request_id) {
      this.logger.log(`companion /generate request_id=${body.request_id}`);
    }
    return {
      text: body.text,
      finishReason: body.finish_reason,
      tokensInput: body.usage?.input_tokens ?? undefined,
      tokensOutput: body.usage?.output_tokens ?? undefined,
      requestId: body.request_id,
    };
  }

  private async post(url: string, request: GenerateRequest, scope: string): Promise<Response> {
    const token = await this.tokens.getAccessToken(scope);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Client': 'cht-reports',
    };
    if (request.requestId) {
      headers['X-Request-Id'] = request.requestId;
    }
    return fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        system_prompt: request.systemPrompt,
        user_content: request.userContent,
        max_tokens: request.maxTokens ?? this.env.reportMaxOutputTokens,
        temperature: request.temperature,
      }),
    });
  }
}
