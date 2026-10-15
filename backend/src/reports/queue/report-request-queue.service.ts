import { Inject, Injectable } from '@nestjs/common';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';

/** Puts a report request back on the queue with a delay (transcript re-check, CPR-47). */
@Injectable()
export class ReportRequestQueue {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  async requeue(reportId: string, campaignId: string, delaySeconds: number): Promise<void> {
    await this.aws.sqs.send(
      new SendMessageCommand({
        QueueUrl: this.env.reportRequestsQueueUrl,
        MessageBody: JSON.stringify({ reportId, campaignId }),
        DelaySeconds: Math.min(900, Math.max(0, Math.round(delaySeconds))),
      }),
    );
  }
}
