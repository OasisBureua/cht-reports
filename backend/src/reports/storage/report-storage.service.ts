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
   * Print HTML to PDF and store the report under reports/{campaign}/{report}/:
   * - v1.pdf: the deliverable. Platform streams only .pdf keys.
   * - v1.html: the rendered preview, for the future review/edit screen.
   * - v1.json: the structured content the HTML was rendered from, so an
   *   edited report can be re-rendered without regenerating it.
   * Returns the PDF key. version/vN is a follow-up (v1 for now).
   */
  async uploadReport(campaignId: string, requestId: string, html: string, content?: unknown): Promise<string> {
    const prefix = `reports/${campaignId}/${requestId}/v1`;
    const key = `${prefix}.pdf`;
    const body = await this.pdf.print(html);

    if (!body.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new Error(`Printed report is not a PDF (key=${key})`);
    }

    const put = (Key: string, Body: Buffer | string, ContentType: string) =>
      this.aws.s3.send(new PutObjectCommand({ Bucket: this.env.reportsBucket, Key, Body, ContentType }));

    await Promise.all([
      put(`${prefix}.html`, html, 'text/html; charset=utf-8'),
      content === undefined ? Promise.resolve() : put(`${prefix}.json`, JSON.stringify(content, null, 2), 'application/json'),
    ]);
    // PDF last: its key is what marks the report complete for Platform.
    await put(key, body, 'application/pdf');

    return key;
  }

  /**
   * Keep the model's raw reply next to the report (internal: Platform only
   * streams .pdf keys). Written even when generation fails, so a truncated
   * or unparseable reply can be inspected.
   */
  async saveModelReply(campaignId: string, requestId: string, text: string): Promise<string> {
    const key = `reports/${campaignId}/${requestId}/v1.model.txt`;
    await this.aws.s3.send(
      new PutObjectCommand({ Bucket: this.env.reportsBucket, Key: key, Body: text, ContentType: 'text/plain; charset=utf-8' }),
    );
    return key;
  }
}
