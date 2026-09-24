import { mockClient } from 'aws-sdk-client-mock';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ReportStorageService } from './report-storage.service';
import { AwsClients } from '../../aws/aws-clients';
import { testEnv } from '../../config/test-env';

const s3Mock = mockClient(S3Client);

function service(): ReportStorageService {
  return new ReportStorageService(testEnv, { s3: new S3Client({ region: 'us-east-1' }) } as unknown as AwsClients);
}

describe('ReportStorageService', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('uploads the report under an .html key', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    const key = await service().uploadReport('req-1', '<html></html>');

    expect(key).toBe('reports/req-1.html');
  });

  it('sends the html body with a text/html content type', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service().uploadReport('req-1', '<html><body>hi</body></html>');

    const call = s3Mock.commandCalls(PutObjectCommand)[0];
    expect(call.args[0].input.Body).toBe('<html><body>hi</body></html>');
    expect(call.args[0].input.ContentType).toBe('text/html; charset=utf-8');
    expect(call.args[0].input.Bucket).toBe(testEnv.reportsBucket);
  });
});
