/**
 * Polls the report-requests SQS queue (see infrastructure/terraform,
 * module.sqs_report_requests). Long-polling loop started on module init,
 * stopped on shutdown.
 */

import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeleteMessageCommand, ReceiveMessageCommand } from '@aws-sdk/client-sqs';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';
import { AwsClients } from '../aws/aws-clients';
import { ReportGenerationOrchestrator, ReportRequest } from './orchestrator';

const LONG_POLL_WAIT_SECONDS = 20;

@Injectable()
export class ReportRequestsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportRequestsConsumer.name);
  private running = false;
  private pollLoop: Promise<void> | null = null;

  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
    private readonly orchestrator: ReportGenerationOrchestrator,
  ) {}

  onModuleInit(): void {
    this.running = true;
    this.pollLoop = this.poll();
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.pollLoop;
  }

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        const result = await this.aws.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.env.reportRequestsQueueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: LONG_POLL_WAIT_SECONDS,
          }),
        );

        for (const message of result.Messages ?? []) {
          await this.handleMessage(message.Body, message.ReceiptHandle);
        }
      } catch (err) {
        this.logger.error(`Poll loop error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private async handleMessage(body: string | undefined, receiptHandle: string | undefined): Promise<void> {
    if (!body || !receiptHandle) return;

    let request: ReportRequest;
    try {
      const parsed = JSON.parse(body) as { reportId?: string; requestId?: string; campaignId?: string };
      const reportId = parsed.reportId ?? parsed.requestId;
      if (!reportId) {
        throw new Error('missing reportId');
      }
      request = { requestId: reportId, campaignId: parsed.campaignId ?? '' };
    } catch {
      this.logger.error(`Discarding malformed message body: ${body}`);
      await this.deleteMessage(receiptHandle);
      return;
    }

    try {
      await this.orchestrator.handle(request);
    } catch (err) {
      // Don't delete on failure. SQS redelivers up to the queue's
      // maxReceiveCount, then it lands on the DLQ. GenerationStateService's
      // own attempt cap (5) is enforced independently inside the
      // orchestrator; this is the queue-level backstop, not the same limit.
      this.logger.error(
        `Request ${request.requestId} failed, leaving on queue for redelivery: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return;
    }

    await this.deleteMessage(receiptHandle);
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    await this.aws.sqs.send(
      new DeleteMessageCommand({
        QueueUrl: this.env.reportRequestsQueueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
