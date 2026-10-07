import { ReportReadyNotifier } from './report-ready.service';
import { testEnv } from '../../config/test-env';
import type { AppEnv } from '../../config/env';
import type { CognitoM2mTokenService } from '../../auth/cognito-m2m-token.service';

function response(status: number, text = '') {
  return { ok: status >= 200 && status < 300, status, text: async () => text };
}

function setup(env: AppEnv = testEnv) {
  const tokens = {
    getAccessToken: jest.fn().mockResolvedValue('notify-token'),
    invalidate: jest.fn(),
  };
  const notifier = new ReportReadyNotifier(env, tokens as unknown as CognitoM2mTokenService);
  jest.spyOn(notifier as unknown as { delay: (ms: number) => Promise<void> }, 'delay').mockResolvedValue();
  return { notifier, tokens };
}

const message = { requestId: 'rep-1', campaignId: '9', version: 2 };

describe('ReportReadyNotifier', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('POSTs the version to Platform with a platform/reports.notify Bearer token', async () => {
    const mockFetch = jest.fn().mockResolvedValue(response(202));
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier, tokens } = setup();

    await expect(notifier.notify(message)).resolves.toBe(true);

    expect(tokens.getAccessToken).toHaveBeenCalledWith('platform/reports.notify');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://platform.test/api/internal/reports/rep-1/ready');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer notify-token');
    expect(init.headers['X-Request-Id']).toBe('rep-1');
    expect(JSON.parse(init.body)).toEqual({ campaignId: '9', version: 2 });
  });

  it('skips without calling anything when PLATFORM_BASE_URL is not set', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier, tokens } = setup({ ...testEnv, platformBaseUrl: '' });

    await expect(notifier.notify(message)).resolves.toBe(false);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(tokens.getAccessToken).not.toHaveBeenCalled();
  });

  it('retries a 5xx and succeeds', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(response(503, 'busy')).mockResolvedValueOnce(response(202));
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier } = setup();

    await expect(notifier.notify(message)).resolves.toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('drops the cached token after a 401 and retries with a fresh one', async () => {
    const mockFetch = jest.fn().mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(202));
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier, tokens } = setup();

    await expect(notifier.notify(message)).resolves.toBe(true);
    expect(tokens.invalidate).toHaveBeenCalledWith('platform/reports.notify');
    expect(tokens.getAccessToken).toHaveBeenCalledTimes(2);
  });

  it('does not retry other 4xx responses', async () => {
    const mockFetch = jest.fn().mockResolvedValue(response(404, 'Report not found'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier } = setup();

    await expect(notifier.notify(message)).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 attempts and never throws', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier } = setup();

    await expect(notifier.notify(message)).resolves.toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('never throws when the token cannot be minted', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    const { notifier, tokens } = setup();
    tokens.getAccessToken.mockRejectedValue(new Error('invalid_scope'));

    await expect(notifier.notify(message)).resolves.toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
