import { Inject, Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

@Injectable()
export class ReportStorageService {
  private readonly s3 = new S3Client({});

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async uploadReport(requestId: string, docxBuffer: Buffer): Promise<string> {
    const key = `reports/${requestId}.docx`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.env.reportsBucket,
        Key: key,
        Body: docxBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    );

    return key;
  }
}
