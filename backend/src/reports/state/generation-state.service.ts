/**
 * Per-request generation state and retry tracking. Caps retries at 5
 * attempts so a failing pipeline step doesn't loop forever. Backed by
 * DynamoDB, not the reports.* Postgres schema. This is orchestration
 * bookkeeping; CHT PutItem's the row, cht-reports UpdateItem's in place.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';

export type GenerationStatus =
  | 'queued'
  | 'pulling_data'
  | 'generating'
  | 'rendering'
  | 'uploading'
  | 'complete'
  | 'failed';

export interface GenerationState {
  requestId: string;
  campaignId: string | null;
  sources: string[];
  windowStart: string | null;
  windowEnd: string | null;
  status: GenerationStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
}

const STATE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

@Injectable()
export class GenerationStateService {
  private readonly logger = new Logger(GenerationStateService.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  async get(requestId: string): Promise<GenerationState | null> {
    const result = await this.aws.dynamodb.send(
      new GetCommand({
        TableName: this.env.generationStateTable,
        Key: { request_id: requestId },
      }),
    );
    if (!result.Item) return null;
    return this.fromItem(result.Item);
  }

  async initialize(requestId: string): Promise<GenerationState> {
    const now = new Date().toISOString();
    const state: GenerationState = {
      requestId,
      campaignId: null,
      sources: [],
      windowStart: null,
      windowEnd: null,
      status: 'queued',
      attemptCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    };

    await this.aws.dynamodb.send(
      new PutCommand({
        TableName: this.env.generationStateTable,
        Item: this.toItem(state),
        ConditionExpression: 'attribute_not_exists(request_id)',
      }),
    );

    return state;
  }

  async beginAttempt(requestId: string, status: GenerationStatus): Promise<GenerationState> {
    const current = await this.get(requestId);
    const attemptCount = (current?.attemptCount ?? 0) + 1;

    if (attemptCount > this.env.maxGenerationAttempts) {
      this.logger.warn(
        `Request ${requestId} exceeded max generation attempts (${this.env.maxGenerationAttempts})`,
      );
      await this.markFailed(requestId, `Exceeded max attempts (${this.env.maxGenerationAttempts})`);
      throw new Error(
        `Request ${requestId} exceeded max generation attempts (${this.env.maxGenerationAttempts})`,
      );
    }

    return this.update(requestId, { status, attemptCount, lastError: null });
  }

  async markStatus(requestId: string, status: GenerationStatus): Promise<GenerationState> {
    return this.update(requestId, { status });
  }

  async markFailed(requestId: string, error: string): Promise<GenerationState> {
    return this.update(requestId, { status: 'failed', lastError: error });
  }

  async markComplete(requestId: string): Promise<GenerationState> {
    return this.update(requestId, { status: 'complete', lastError: null });
  }

  private async update(
    requestId: string,
    patch: Partial<Pick<GenerationState, 'status' | 'attemptCount' | 'lastError'>>,
  ): Promise<GenerationState> {
    const now = new Date().toISOString();
    const names: Record<string, string> = { '#updated_at': 'updated_at' };
    const values: Record<string, unknown> = { ':updated_at': now };
    const sets = ['#updated_at = :updated_at'];

    if (patch.status !== undefined) {
      names['#status'] = 'status';
      values[':status'] = patch.status;
      sets.push('#status = :status');
    }
    if (patch.attemptCount !== undefined) {
      names['#attempt_count'] = 'attempt_count';
      values[':attempt_count'] = patch.attemptCount;
      sets.push('#attempt_count = :attempt_count');
    }
    if (patch.lastError !== undefined) {
      names['#last_error'] = 'last_error';
      values[':last_error'] = patch.lastError;
      sets.push('#last_error = :last_error');
    }

    const result = await this.aws.dynamodb.send(
      new UpdateCommand({
        TableName: this.env.generationStateTable,
        Key: { request_id: requestId },
        UpdateExpression: `SET ${sets.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }),
    );

    return this.fromItem(result.Attributes!);
  }

  private toItem(state: GenerationState): Record<string, unknown> {
    return {
      request_id: state.requestId,
      campaign_id: state.campaignId,
      sources: state.sources,
      window_start: state.windowStart,
      window_end: state.windowEnd,
      status: state.status,
      attempt_count: state.attemptCount,
      last_error: state.lastError,
      created_at: state.createdAt,
      updated_at: state.updatedAt,
      expires_at: state.expiresAt,
    };
  }

  private fromItem(item: Record<string, unknown>): GenerationState {
    return {
      requestId: item.request_id as string,
      campaignId: (item.campaign_id as string) ?? null,
      sources: (item.sources as string[]) ?? [],
      windowStart: (item.window_start as string) ?? null,
      windowEnd: (item.window_end as string) ?? null,
      status: item.status as GenerationStatus,
      attemptCount: item.attempt_count as number,
      lastError: (item.last_error as string) ?? null,
      createdAt: item.created_at as string,
      updatedAt: item.updated_at as string,
      expiresAt: item.expires_at as number,
    };
  }
}
