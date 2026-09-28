import { Inject, Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import type { AppEnv } from '../../config/env';
import { APP_ENV } from '../../config/config.module';
import { AwsClients } from '../../aws/aws-clients';
import { PDF_PRINTER, type PdfPrinter } from '../render/pdf-printer';

@Injectable()
export class ReportStorageService {
  constructor(
    @Inject(APP_ENV) private readonly env: AppEnv,
    private readonly aws: AwsClients,
    @Inject(PDF_PRINTER) private readonly pdf: PdfPrinter,
  ) {}

  /**
   * Print HTML → PDF and PutObject. Key is under reports/ and ends in .pdf
   * so Platform will stream it. version/vN is a follow-up (v1 for now).
   */
  async uploadReport(campaignId: string, requestId: string, html: string): Promise<string> {
    const key = `reports/${campaignId}/${requestId}/v1.pdf`;
    const body = await this.pdf.print(html);

    if (!body.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error(`Printed report is not a PDF (key=${key})`);
    }

    await this.aws.s3.send(
      new PutObjectCommand({
        Bucket: this.env.reportsBucket,
        Key: key,
        Body: body,
        ContentType: 'application/pdf',
      }),
    );

    return key;
  }
}
