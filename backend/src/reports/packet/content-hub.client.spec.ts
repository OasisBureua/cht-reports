import { ContentHubClient, ContentHubClientError, contentHubApiBase } from './content-hub.client';
import { testEnv } from '../../config/test-env';

describe('contentHubApiBase', () => {
  it.each([
    'https://hub.test',
    'https://hub.test/',
    'https://hub.test/api',
    'https://hub.test/api/public',
    'https://hub.test/api/admin/',
  ])('normalizes %s to the /api root', (url) => {
    expect(contentHubApiBase(url)).toBe('https://hub.test/api');
  });
});

describe('ContentHubClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GETs report-packet with window and sources', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        campaignId: 9,
        campaignName: 'Q2',
        sessions: [],
        surveyResponses: [],
        platformSlices: [],
        inputCompleteness: {},
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new ContentHubClient({ ...testEnv, contentHubBaseUrl: 'https://hub.test' });
    const packet = await client.fetchReportPacket({
      campaignId: 9,
      windowStart: '2026-01-01',
      windowEnd: '2026-03-31',
      sources: ['linkedin', 'zoom'],
    });

    expect(packet.campaignId).toBe(9);
    const called = mockFetch.mock.calls[0][0] as string;
    expect(called).toContain('https://hub.test/api/campaigns/9/report-packet');
    expect(called).not.toContain('/api/admin');
    expect(called).not.toContain('/api/public');
    expect(called).toContain('windowStart=2026-01-01');
    expect(called).toContain('sources=linkedin');
    expect(mockFetch.mock.calls[0][1].headers['X-API-Key']).toBe('hub-key');
    expect(mockFetch.mock.calls[0][1].headers['X-Request-Id']).toEqual(expect.any(String));
  });

  it('rewrites an /api/public CONTENTHUB_BASE_URL onto the packet path', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaignId: 1, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new ContentHubClient({
      ...testEnv,
      contentHubBaseUrl: 'https://devhub.communityhealth.media/api/public',
    });
    await client.fetchReportPacket({ campaignId: 1 });

    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://devhub.communityhealth.media/api/campaigns/1/report-packet',
    );
  });

  it('throws ContentHubClientError on non-OK', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'missing',
    }) as unknown as typeof fetch;

    const client = new ContentHubClient(testEnv);
    await expect(client.fetchReportPacket({ campaignId: 1 })).rejects.toThrow(ContentHubClientError);
  });
});