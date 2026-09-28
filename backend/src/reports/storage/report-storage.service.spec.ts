import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ReportStorageService } from './report-storage.service';
import { AwsClients } from '../../aws/aws-clients';
import { testEnv } from '../../config/test-env';
import type { PdfPrinter } from '../render/pdf-printer';

const s3Mock = mockClient(S3Client);
const PDF_BYTES = Buffer.from('%PDF-1.4\n% test pdf\ntrailer\n%%EOF\n');

function service(printer?: PdfPrinter): ReportStorageService {
  const pdf: PdfPrinter = printer ?? {
    print: async () => PDF_BYTES,
  };
  return new ReportStorageService(
    testEnv,
    { s3: new S3Client({ region: 'us-east-1' }) } as unknown as AwsClients,
    pdf,
  );
}

describe('ReportStorageService', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('uploads a printed PDF under reports/{campaignId}/{reportId}/v1.pdf', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const key = await service().uploadReport('9', 'req-1', '<html></html>');

    expect(key).toBe('reports/9/req-1/v1.pdf');
  });

  it('sends the PDF body with application/pdf', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service().uploadReport('9', 'req-1', '<html><body>hi</body></html>');

    const call = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(Buffer.isBuffer(call.args[0].input.Body)).toBe(true);
    expect(call.args[0].input.Body).toEqual(PDF_BYTES);
    expect(call.args[0].input.ContentType).toBe('application/pdf');
    expect(call.args[0].input.Bucket).toBe(testEnv.reportsBucket);
    expect(call.args[0].input.Key).toBe('reports/9/req-1/v1.pdf');
  });

  it('rejects a print that is not a PDF header', async () => {
    const htmlPrinter: PdfPrinter = {
      print: async () => Buffer.from('<html>not a pdf</html>'),
    };

    await expect(service(htmlPrinter).uploadReport('9', 'req-1', '<html></html>')).rejects.toThrow(
      /not a PDF/i,
    );
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });
});
