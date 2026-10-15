import { mockClient } from 'aws-sdk-client-mock';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { TemplateStore } from './template-store.service';
import { AwsClients } from '../../aws/aws-clients';
import { testEnv } from '../../config/test-env';
import { BUILTIN_HTML_TEMPLATE, BUILTIN_SYSTEM_PROMPT } from './builtin';

const s3Mock = mockClient(S3Client);

const POINTER = {
  id: 1,
  type: 'executive_summary',
  semver: '1.1.0',
  s3Key: 'templates/executive_summary/1.1.0/',
};

function body(text: string) {
  return { transformToString: async () => text };
}

function store(): TemplateStore {
  return new TemplateStore(testEnv, { s3: new S3Client({ region: 'us-east-1' }) } as unknown as AwsClients);
}

function mockFiles(prompt: string, html: string) {
  s3Mock
    .on(GetObjectCommand, { Key: `${POINTER.s3Key}system-prompt.md` })
    .callsFake(() => ({ Body: body(prompt) }));
  s3Mock
    .on(GetObjectCommand, { Key: `${POINTER.s3Key}template.html` })
    .callsFake(() => ({ Body: body(html) }));
}

describe('TemplateStore', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('uses the built-in template without calling S3 when the packet has no pointer', async () => {
    const result = await store().load(null);

    expect(result.template.source).toBe('builtin');
    expect(result.template.systemPrompt).toBe(BUILTIN_SYSTEM_PROMPT);
    expect(result.template.html).toBe(BUILTIN_HTML_TEMPLATE);
    expect(result.note).toBeNull();
    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(0);
  });

  it('loads the prompt and HTML from the pointer prefix in the reports bucket', async () => {
    mockFiles('Custom prompt\n', '<html>{{title}}</html>');

    const result = await store().load(POINTER);

    expect(result.template).toEqual({
      systemPrompt: 'Custom prompt',
      html: '<html>{{title}}</html>',
      source: 's3',
      semver: '1.1.0',
    });
    expect(result.note).toBeNull();
    const keys = s3Mock.commandCalls(GetObjectCommand).map((c) => c.args[0].input.Key).sort();
    expect(keys).toEqual([
      'templates/executive_summary/1.1.0/system-prompt.md',
      'templates/executive_summary/1.1.0/template.html',
    ]);
    expect(s3Mock.commandCalls(GetObjectCommand)[0].args[0].input.Bucket).toBe(testEnv.reportsBucket);
  });

  it('accepts an s3Key without a trailing slash', async () => {
    mockFiles('Prompt', '<html></html>');

    const result = await store().load({ ...POINTER, s3Key: 'templates/executive_summary/1.1.0' });

    expect(result.template.source).toBe('s3');
  });

  it('caches a loaded version and does not refetch it', async () => {
    mockFiles('Prompt', '<html></html>');
    const s = store();

    await s.load(POINTER);
    await s.load(POINTER);

    expect(s3Mock.commandCalls(GetObjectCommand)).toHaveLength(2);
  });

  it('falls back to built-in with a note when S3 fails, and retries next time', async () => {
    s3Mock.on(GetObjectCommand).rejects(new Error('NoSuchKey'));
    const s = store();

    const result = await s.load(POINTER);

    expect(result.template.source).toBe('builtin');
    expect(result.note).toContain('executive_summary 1.1.0');

    s3Mock.reset();
    mockFiles('Prompt', '<html></html>');
    const retry = await s.load(POINTER);
    expect(retry.template.source).toBe('s3');
  });

  it('falls back when a template file is empty', async () => {
    mockFiles('   ', '<html></html>');

    const result = await store().load(POINTER);

    expect(result.template.source).toBe('builtin');
    expect(result.note).not.toBeNull();
  });
});
