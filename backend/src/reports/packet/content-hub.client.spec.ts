import { ContentHubClient, ContentHubClientError, contentHubApiBase, toHubDate } from './content-hub.client';
import { testEnv } from '../../config/test-env';
import type { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';

function tokenStub(...tokens: string[]) {
  const queue = [...tokens];
  return {
    getAccessToken: jest.fn(async () => queue.shift() ?? tokens[tokens.length - 1]),
    invalidate: jest.fn(),
  } as unknown as CognitoM2mTokenService & { getAccessToken: jest.Mock; invalidate: jest.Mock };
}

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

describe('toHubDate', () => {
  it('keeps a plain date', () => {
    expect(toHubDate('2026-08-29')).toBe('2026-08-29');
  });

  it('turns an ISO timestamp into its UTC date', () => {
    expect(toHubDate('2026-08-29T21:43:20.275Z')).toBe('2026-08-29');
    expect(toHubDate('2026-08-29T23:30:00-04:00')).toBe('2026-08-30');
  });

  it('passes an unparseable value through so Hub reports it', () => {
    expect(toHubDate('last-month')).toBe('last-month');
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

    const client = new ContentHubClient({ ...testEnv, contentHubBaseUrl: 'https://hub.test' }, tokenStub('tok-1'));
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
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    expect(mockFetch.mock.calls[0][1].headers['X-API-Key']).toBeUndefined();
    expect(mockFetch.mock.calls[0][1].headers['X-Request-Id']).toEqual(expect.any(String));
  });

  it('sends a timestamp window as dates (Hub 422s on datetimes)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaignId: 6, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new ContentHubClient({ ...testEnv, contentHubBaseUrl: 'https://hub.test' }, tokenStub('tok-1'));
    await client.fetchReportPacket({
      campaignId: 6,
      windowStart: '2026-08-29T21:43:20.275Z',
      windowEnd: '2026-09-28T21:43:20.275Z',
    });

    const called = mockFetch.mock.calls[0][0] as string;
    expect(called).toContain('windowStart=2026-08-29&');
    expect(called).toContain('windowEnd=2026-09-28');
    expect(called).not.toContain('T21');
  });

  it('rewrites an /api/public CONTENTHUB_BASE_URL onto the packet path', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ campaignId: 1, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new ContentHubClient(
      { ...testEnv, contentHubBaseUrl: 'https://devhub.communityhealth.media/api/public' },
      tokenStub('tok-1'),
    );
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

    const client = new ContentHubClient(testEnv, tokenStub('tok-1'));
    await expect(client.fetchReportPacket({ campaignId: 1 })).rejects.toThrow(ContentHubClientError);
  });

  it('on 401 drops the cached token and retries once with a fresh one', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'expired' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ campaignId: 3, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;
    const tokens = tokenStub('stale', 'fresh');

    const packet = await new ContentHubClient(testEnv, tokens).fetchReportPacket({ campaignId: 3 });

    expect(packet.campaignId).toBe(3);
    expect(tokens.invalidate).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stale');
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
    expect(mockFetch.mock.calls[1][1].headers['X-Request-Id']).toBe(mockFetch.mock.calls[0][1].headers['X-Request-Id']);
  });

  it('gives up after one retry when Hub still answers 401', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'Missing bearer token' });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(new ContentHubClient(testEnv, tokenStub('a', 'b')).fetchReportPacket({ campaignId: 1 })).rejects.toThrow(
      /401/,
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});