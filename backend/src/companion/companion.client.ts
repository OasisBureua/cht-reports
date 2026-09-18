/**
 * Client for cht-companion POST /generate: a plain Bedrock completion,
 * no retrieval. Reached over Service Connect.
 *
 * Not the same endpoint /chat uses. /chat does RAG; reports assemble their
 * own Content Hub packet and need prompt-in / completion-out.
 *
 * Auth: X-BFF-Auth (COMPANION_INTERNAL_SECRET).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

export interface GenerateRequest {
  systemPrompt: string;
  userContent: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  finishReason: 'complete' | 'truncated' | 'error' | 'cancelled';
  tokensInput?: number;
  tokensOutput?: number;
}

export class CompanionGenerationError extends Error {}

interface CompanionGenerateResponse {
  text: string;
  finish_reason: GenerateResult['finishReason'];
  request_id: string;
}

interface CompanionErrorResponse {
  error: { code: string; message: string; retry_after_ms?: number };
}

@Injectable()
export class CompanionClient {
  private readonly logger = new Logger(CompanionClient.name);

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const url = `${this.env.companionServiceConnectUrl}/generate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BFF-Auth': this.env.companionInternalSecret,
        'X-Client': 'cht-reports',
      },
      body: JSON.stringify({
        system_prompt: request.systemPrompt,
        user_content: request.userContent,
        max_tokens: request.maxTokens ?? 4096,
        temperature: request.temperature,
      }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as CompanionErrorResponse | null;
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(`companion /generate failed (${response.status}): ${message}`);
      throw new CompanionGenerationError(`companion /generate returned ${response.status}: ${message}`);
    }

    const body = (await response.json()) as CompanionGenerateResponse;
    return { text: body.text, finishReason: body.finish_reason };
  }
}
