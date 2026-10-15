import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ReportStorageService, reportVersion } from './report-storage.service';
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

  it('stores the raw model reply as internal text next to the report', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const key = await service().saveModelReply('9', 'req-1', 1, '{"partial":');

    expect(key).toBe('reports/9/req-1/v1.model.txt');
    const input = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(input.Body).toBe('{"partial":');
    expect(input.ContentType).toBe('text/plain; charset=utf-8');
  });

  it('uploads a printed PDF under reports/{campaignId}/{reportId}/v1.pdf', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const key = await service().uploadReport('9', 'req-1', 1, '<html></html>');

    expect(key).toBe('reports/9/req-1/v1.pdf');
  });

  it('sends the PDF body with application/pdf', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service().uploadReport('9', 'req-1', 1, '<html><body>hi</body></html>');

    const call = s3Mock.commandCalls(PutObjectCommand).find((c) => c.args[0].input.Key?.endsWith('.pdf'))!;
    expect(Buffer.isBuffer(call.args[0].input.Body)).toBe(true);
    expect(call.args[0].input.Body).toEqual(PDF_BYTES);
    expect(call.args[0].input.ContentType).toBe('application/pdf');
    expect(call.args[0].input.Bucket).toBe(testEnv.reportsBucket);
    expect(call.args[0].input.Key).toBe('reports/9/req-1/v1.pdf');
  });

  it('stores the HTML preview and content JSON next to the PDF, PDF last', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service().uploadReport('9', 'req-1', 1, '<html>preview</html>', { title: 'T' });

    const calls = s3Mock.commandCalls(PutObjectCommand).map((c) => c.args[0].input);
    expect(calls.map((i) => i.Key)).toEqual(
      expect.arrayContaining(['reports/9/req-1/v1.html', 'reports/9/req-1/v1.json', 'reports/9/req-1/v1.pdf']),
    );
    expect(calls[calls.length - 1].Key).toBe('reports/9/req-1/v1.pdf');
    const html = calls.find((i) => i.Key === 'reports/9/req-1/v1.html')!;
    expect(html.Body).toBe('<html>preview</html>');
    expect(html.ContentType).toBe('text/html; charset=utf-8');
    const json = calls.find((i) => i.Key === 'reports/9/req-1/v1.json')!;
    expect(JSON.parse(json.Body as string)).toEqual({ title: 'T' });
  });

  it('skips the JSON when no content is passed', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service().uploadReport('9', 'req-1', 1, '<html></html>');

    expect(s3Mock.commandCalls(PutObjectCommand).map((c) => c.args[0].input.Key)).toEqual([
      'reports/9/req-1/v1.html',
      'reports/9/req-1/v1.pdf',
    ]);
  });

  it('writes each version under its own vN keys, leaving earlier versions alone', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const key = await service().uploadReport('9', 'req-1', 3, '<html></html>', { title: 'T' });
    const modelKey = await service().saveModelReply('9', 'req-1', 3, 'reply');

    expect(key).toBe('reports/9/req-1/v3.pdf');
    expect(modelKey).toBe('reports/9/req-1/v3.model.txt');
    expect(s3Mock.commandCalls(PutObjectCommand).map((c) => c.args[0].input.Key)).toEqual(
      expect.arrayContaining(['reports/9/req-1/v3.html', 'reports/9/req-1/v3.json', 'reports/9/req-1/v3.pdf']),
    );
    expect(s3Mock.commandCalls(PutObjectCommand).some((c) => c.args[0].input.Key?.includes('/v1.'))).toBe(false);
  });

  it('rejects a print that is not a PDF header', async () => {
    const htmlPrinter: PdfPrinter = {
      print: async () => Buffer.from('<html>not a pdf</html>'),
    };

    await expect(service(htmlPrinter).uploadReport('9', 'req-1', 1, '<html></html>')).rejects.toThrow(
      /not a PDF/i,
    );
    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(0);
  });
});

describe('reportVersion', () => {
  it('is v1 for the first report and one more per Regenerate', () => {
    expect(reportVersion(0)).toBe(1);
    expect(reportVersion(1)).toBe(2);
    expect(reportVersion(3)).toBe(4);
  });

  it('treats a missing or bad edit count as the first report', () => {
    expect(reportVersion(undefined as unknown as number)).toBe(1);
    expect(reportVersion(-2)).toBe(1);
  });
});
