import { Inject, Injectable } from '@nestjs/common';
import { PublishCommand } from '@aws-sdk/client-sns';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';

export interface ReportReadyMessage {
  requestId: string;
  campaignId: string;
  s3Key: string;
}

@Injectable()
export class ReportReadyNotifier {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  async notify(message: ReportReadyMessage): Promise<void> {
    await this.aws.sns.send(
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
