import { CognitoM2mTokenError, CognitoM2mTokenService } from './cognito-m2m-token.service';
import { testEnv } from '../config/test-env';
import type { AppEnv } from '../config/env';

function tokenResponse(accessToken: string, expiresIn = 3600) {
  return { ok: true, status: 200, json: async () => ({ access_token: accessToken, expires_in: expiresIn }) };
}

describe('CognitoM2mTokenService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('mints with client_credentials: Basic auth, scope, form body', async () => {
    const mockFetch = jest.fn().mockResolvedValue(tokenResponse('tok-1'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const token = await new CognitoM2mTokenService(testEnv).getAccessToken();

    expect(token).toBe('tok-1');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://auth.test/oauth2/token');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('test-client:test-client-secret').toString('base64')}`,
    );
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(String(init.body)).toBe('grant_type=client_credentials&scope=hub%2Freports.read');
  });

  it('mints and caches one token per scope, and invalidates per scope', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse('hub-1'))
      .mockResolvedValueOnce(tokenResponse('notify-1'))
      .mockResolvedValueOnce(tokenResponse('notify-2'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const service = new CognitoM2mTokenService(testEnv);

    expect(await service.getAccessToken()).toBe('hub-1');
    expect(await service.getAccessToken('platform/reports.notify')).toBe('notify-1');
    expect(String(mockFetch.mock.calls[1][1].body)).toBe(
      'grant_type=client_credentials&scope=platform%2Freports.notify',
    );

    service.invalidate('platform/reports.notify');
    expect(await service.getAccessToken()).toBe('hub-1');
    expect(await service.getAccessToken('platform/reports.notify')).toBe('notify-2');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('reuses the cached token until ~60s before expiry, then refreshes', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-28T12:00:00Z') });
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse('tok-1', 3600))
      .mockResolvedValueOnce(tokenResponse('tok-2', 3600));
    global.fetch = mockFetch as unknown as typeof fetch;
    const service = new CognitoM2mTokenService(testEnv);

    expect(await service.getAccessToken()).toBe('tok-1');
    jest.setSystemTime(new Date('2026-09-28T12:58:00Z')); // 58 min: still cached
    expect(await service.getAccessToken()).toBe('tok-1');
    jest.setSystemTime(new Date('2026-09-28T12:59:30Z')); // inside the 60s refresh window
    expect(await service.getAccessToken()).toBe('tok-2');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    let resolve!: (v: unknown) => void;
    const mockFetch = jest.fn().mockReturnValue(new Promise((r) => (resolve = r)));
    global.fetch = mockFetch as unknown as typeof fetch;
    const service = new CognitoM2mTokenService(testEnv);

    const pending = Promise.all([service.getAccessToken(), service.getAccessToken(), service.getAccessToken()]);
    resolve(tokenResponse('tok-1'));

    expect(await pending).toEqual(['tok-1', 'tok-1', 'tok-1']);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces a fresh mint', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce(tokenResponse('tok-1'))
      .mockResolvedValueOnce(tokenResponse('tok-2'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const service = new CognitoM2mTokenService(testEnv);

    await service.getAccessToken();
    service.invalidate();

    expect(await service.getAccessToken()).toBe('tok-2');
  });

  it('throws when Cognito rejects the request, and does not cache the failure', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'invalid_scope' }) })
      .mockResolvedValueOnce(tokenResponse('tok-1'));
    global.fetch = mockFetch as unknown as typeof fetch;
    const service = new CognitoM2mTokenService(testEnv);

    await expect(service.getAccessToken()).rejects.toThrow(CognitoM2mTokenError);
    expect(await service.getAccessToken()).toBe('tok-1');
  });

  it('throws on a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;

    await expect(new CognitoM2mTokenService(testEnv).getAccessToken()).rejects.toThrow(
      'Unable to obtain M2M token for hub/reports.read',
    );
  });

  it('is not configured without credentials: throws on use, warm is skipped', async () => {
    const mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
    const env: AppEnv = { ...testEnv, contentHubM2m: { ...testEnv.contentHubM2m, clientSecret: '' } };
    const service = new CognitoM2mTokenService(env);

    expect(service.isConfigured()).toBe(false);
    await service.onModuleInit();
    await expect(service.getAccessToken()).rejects.toThrow(CognitoM2mTokenError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('warms on boot and never throws from onModuleInit', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down')) as unknown as typeof fetch;

    await expect(new CognitoM2mTokenService(testEnv).onModuleInit()).resolves.toBeUndefined();
  });
});
