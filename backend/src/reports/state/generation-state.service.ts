/**
 * Per-request generation state and retry tracking. Caps retries at 5
 * attempts so a failing pipeline step doesn't loop forever. Backed by
 * DynamoDB, not the reports.* Postgres schema. This is orchestration
 * bookkeeping; CHT PutItem's the row, cht-reports UpdateItem's in place.
 *
 * Key: campaign_id (partition) + report_id (sort). Looking a report up by
 * id alone goes through the report_id GSI.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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

export const REPORT_ID_INDEX = 'report_id-index';

export interface GenerationState {
  requestId: string;
  campaignId: string;
  sources: string[];
  windowStart: string | null;
  windowEnd: string | null;
  status: GenerationStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class GenerationStateService {
  private readonly logger = new Logger(GenerationStateService.name);

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  /**
   * With a campaignId this is a consistent GetItem on the full key. Without
   * one it queries the report_id GSI, which is eventually consistent.
   */
  async get(requestId: string, campaignId?: string): Promise<GenerationState | null> {
    if (campaignId) {
      const result = await this.aws.dynamodb.send(
        new GetCommand({
          TableName: this.env.generationStateTable,
          Key: { campaign_id: campaignId, report_id: requestId },
          ConsistentRead: true,
        }),
      );
      return result.Item ? this.fromItem(result.Item) : null;
    }

    const result = await this.aws.dynamodb.send(
      new QueryCommand({
        TableName: this.env.generationStateTable,
        IndexName: REPORT_ID_INDEX,
        KeyConditionExpression: 'report_id = :report_id',
        ExpressionAttributeValues: { ':report_id': requestId },
        Limit: 1,
      }),
    );
    const item = result.Items?.[0];
    return item ? this.fromItem(item) : null;
  }

  async initialize(requestId: string, campaignId: string): Promise<GenerationState> {
    const now = new Date().toISOString();
    const state: GenerationState = {
      requestId,
      campaignId,
      sources: [],
      windowStart: null,
      windowEnd: null,
      status: 'queued',
      attemptCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };

    await this.aws.dynamodb.send(
      new PutCommand({
        TableName: this.env.generationStateTable,
        Item: this.toItem(state),
        ConditionExpression: 'attribute_not_exists(report_id)',
      }),
    );

    return state;
  }

  async beginAttempt(requestId: string, status: GenerationStatus): Promise<GenerationState> {
    const current = await this.require(requestId);
    const attemptCount = current.attemptCount + 1;

    if (attemptCount > this.env.maxGenerationAttempts) {
      this.logger.warn(
        `Request ${requestId} exceeded max generation attempts (${this.env.maxGenerationAttempts})`,
      );
      await this.markFailed(requestId, `Exceeded max attempts (${this.env.maxGenerationAttempts})`);
      throw new Error(
        `Request ${requestId} exceeded max generation attempts (${this.env.maxGenerationAttempts})`,
      );
    }

    return this.update(current, { status, attemptCount, lastError: null });
  }

  async markStatus(requestId: string, status: GenerationStatus): Promise<GenerationState> {
    return this.update(await this.require(requestId), { status });
  }

  async markFailed(requestId: string, error: string): Promise<GenerationState> {
    return this.update(await this.require(requestId), { status: 'failed', lastError: error });
  }

  async markComplete(requestId: string): Promise<GenerationState> {
    return this.update(await this.require(requestId), { status: 'complete', lastError: null });
  }

  private async require(requestId: string): Promise<GenerationState> {
    const state = await this.get(requestId);
    if (!state) throw new Error(`Report ${requestId} has no generation state row`);
    return state;
  }

  private async update(
    current: GenerationState,
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
        Key: { campaign_id: current.campaignId, report_id: current.requestId },
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
      campaign_id: state.campaignId,
      report_id: state.requestId,
      sources: state.sources,
      window_start: state.windowStart,
      window_end: state.windowEnd,
      status: state.status,
      attempt_count: state.attemptCount,
      last_error: state.lastError,
      created_at: state.createdAt,
      updated_at: state.updatedAt,
    };
  }

  private fromItem(item: Record<string, unknown>): GenerationState {
    return {
      requestId: item.report_id as string,
      campaignId: item.campaign_id as string,
      sources: (item.sources as string[]) ?? [],
      windowStart: (item.window_start as string) ?? null,
      windowEnd: (item.window_end as string) ?? null,
      status: item.status as GenerationStatus,
      attemptCount: item.attempt_count as number,
      lastError: (item.last_error as string) ?? null,
      createdAt: item.created_at as string,
      updatedAt: item.updated_at as string,
    };
  }
}
