import {
  ContentHubClient,
  ContentHubClientError,
  contentHubApiBase,
  sameOriginRedirect,
  toHubDate,
} from './content-hub.client';
import { testEnv } from '../../config/test-env';
import type { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';

function tokenStub(...tokens: string[]) {
  const queue = [...tokens];
  return {
    getAccessToken: jest.fn(async () => queue.shift() ?? tokens[tokens.length - 1]),
    invalidate: jest.fn(),
  } as unknown as CognitoM2mTokenService & { getAccessToken: jest.Mock; invalidate: jest.Mock };
}

function mockRes(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
    json: async () => (typeof body === 'string' ? {} : body),
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null },
    clone: () => ({ text: async () => text }),
  };
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

describe('sameOriginRedirect', () => {
  it('resolves a relative Location against the request URL', () => {
    expect(sameOriginRedirect('https://hub.test/api/campaigns/1/report-packet', '/api/campaigns/1/report-packet/')).toBe(
      'https://hub.test/api/campaigns/1/report-packet/',
    );
  });

  it('rejects a different origin', () => {
    expect(sameOriginRedirect('https://hub.test/api/x', 'https://evil.test/api/x')).toBeNull();
  });
});

describe('ContentHubClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GETs report-packet with window and sources', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      mockRes(200, {
        campaignId: 9,
        campaignName: 'Q2',
        sessions: [],
        surveyResponses: [],
        platformSlices: [],
        inputCompleteness: {},
      }),
    );
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
    expect(mockFetch.mock.calls[0][1].redirect).toBe('manual');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    expect(mockFetch.mock.calls[0][1].headers['X-API-Key']).toBeUndefined();
    expect(mockFetch.mock.calls[0][1].headers['X-Request-Id']).toEqual(expect.any(String));
  });

  it('sends a timestamp window as dates (Hub 422s on datetimes)', async () => {
    const mockFetch = jest.fn().mockResolvedValue(
      mockRes(200, { campaignId: 6, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
    );
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
    const mockFetch = jest.fn().mockResolvedValue(
      mockRes(200, { campaignId: 1, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
    );
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
    global.fetch = jest.fn().mockResolvedValue(mockRes(404, 'missing')) as unknown as typeof fetch;

    const client = new ContentHubClient(testEnv, tokenStub('tok-1'));
    await expect(client.fetchReportPacket({ campaignId: 1 })).rejects.toThrow(ContentHubClientError);
  });

  it('on 401 drops the cached token and retries once with a fresh one', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(mockRes(401, 'expired'))
      .mockResolvedValueOnce(
        mockRes(200, { campaignId: 3, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
      );
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

  it('does not mint a second token when Hub says the Bearer header was missing', async () => {
    const mockFetch = jest.fn().mockResolvedValue(mockRes(401, '{"detail":"Missing bearer token"}'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const tokens = tokenStub('a', 'b');

    await expect(new ContentHubClient(testEnv, tokens).fetchReportPacket({ campaignId: 1 })).rejects.toThrow(/401/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(tokens.invalidate).not.toHaveBeenCalled();
  });

  it('re-attaches Authorization on a same-origin redirect', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockRes(307, '', { location: 'https://hub.test/api/campaigns/1/report-packet/' }),
      )
      .mockResolvedValueOnce(
        mockRes(200, { campaignId: 1, sessions: [], surveyResponses: [], platformSlices: [], inputCompleteness: {} }),
      );
    global.fetch = mockFetch as unknown as typeof fetch;

    await new ContentHubClient(testEnv, tokenStub('tok-1')).fetchReportPacket({ campaignId: 1, requestId: 'R1' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe('https://hub.test/api/campaigns/1/report-packet/');
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-1');
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-1');
    expect(mockFetch.mock.calls[1][1].headers['X-Request-Id']).toBe('R1');
  });
});