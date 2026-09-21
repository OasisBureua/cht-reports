import { Inject, Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';

@Injectable()
export class ReportStorageService {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
  ) {}

  async uploadReport(requestId: string, html: string): Promise<string> {
    const key = `reports/${requestId}.html`;

    await this.aws.s3.send(
      new PutObjectCommand({
        Bucket: this.env.reportsBucket,
        Key: key,
        Body: html,
        ContentType: 'text/html; charset=utf-8',
      }),
    );

    return key;
  }
}
