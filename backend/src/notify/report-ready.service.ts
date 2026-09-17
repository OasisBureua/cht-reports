import { Inject, Injectable } from '@nestjs/common';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

export interface ReportReadyMessage {
  requestId: string;
  campaignId: string;
  s3Key: string;
}

@Injectable()
export class ReportReadyNotifier {
  private readonly sns = new SNSClient({});

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async notify(message: ReportReadyMessage): Promise<void> {
    await this.sns.send(
      new PublishCommand({
        TopicArn: this.env.reportReadyTopicArn,
        Message: JSON.stringify(message),
        MessageAttributes: {
          requestId: { DataType: 'String', StringValue: message.requestId },
        },
      }),
    );
  }
}
