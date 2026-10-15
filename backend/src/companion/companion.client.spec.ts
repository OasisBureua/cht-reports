import { CompanionClient, CompanionGenerationError, COMPANION_GENERATE_SCOPE } from './companion.client';
import { testEnv } from '../config/test-env';
import type { CognitoM2mTokenService } from '../auth/cognito-m2m-token.service';

function tokenStub(...tokens: string[]) {
  const queue = [...tokens];
  return {
    getAccessToken: jest.fn(async () => queue.shift() ?? tokens[tokens.length - 1]),
    invalidate: jest.fn(),
  } as unknown as CognitoM2mTokenService & { getAccessToken: jest.Mock; invalidate: jest.Mock };
}

describe('CompanionClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls companion /generate with Bearer M2M and X-Request-Id', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Generated text.', finish_reason: 'complete', request_id: 'rep-1' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;
    const tokens = tokenStub('tok-1');

    const client = new CompanionClient(testEnv, tokens);
    const result = await client.generate({
      systemPrompt: 'System',
      userContent: 'User content',
      requestId: 'rep-1',
    });

    expect(result).toEqual({
      text: 'Generated text.',
      finishReason: 'complete',
      tokensInput: undefined,
      tokensOutput: undefined,
      requestId: 'rep-1',
    });
    expect(tokens.getAccessToken).toHaveBeenCalledWith(COMPANION_GENERATE_SCOPE);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://cht-companion:8080/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer tok-1',
          'Content-Type': 'application/json',
          'X-Client': 'cht-reports',
          'X-Request-Id': 'rep-1',
        }),
      }),
    );
    expect(mockFetch.mock.calls[0][1].headers['X-BFF-Auth']).toBeUndefined();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      system_prompt: 'System',
      user_content: 'User content',
      max_tokens: 16000,
      temperature: undefined,
    });
  });

  it('uses REPORT_MAX_OUTPUT_TOKENS by default and maps usage from the response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        text: 'T',
        finish_reason: 'truncated',
        request_id: 'req-2',
        usage: { input_tokens: 23571, output_tokens: 8192 },
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new CompanionClient({ ...testEnv, reportMaxOutputTokens: 24000 }, tokenStub('tok-1'));
    const result = await client.generate({ systemPrompt: 'S', userContent: 'U' });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body).max_tokens).toBe(24000);
    expect(result).toEqual({
      text: 'T',
      finishReason: 'truncated',
      tokensInput: 23571,
      tokensOutput: 8192,
      requestId: 'req-2',
    });
  });

  it('on 401 invalidates the companion scope and retries once with a fresh token', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { message: 'expired' } }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ text: 'ok', finish_reason: 'complete', request_id: 'rep-1' }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;
    const tokens = tokenStub('stale', 'fresh');

    const result = await new CompanionClient(testEnv, tokens).generate({
      systemPrompt: 'S',
      userContent: 'U',
      requestId: 'rep-1',
    });

    expect(result.text).toBe('ok');
    expect(tokens.invalidate).toHaveBeenCalledWith(COMPANION_GENERATE_SCOPE);
    expect(tokens.getAccessToken).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stale');
    expect(mockFetch.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
    expect(mockFetch.mock.calls[1][1].headers['X-Request-Id']).toBe('rep-1');
  });

  it('throws CompanionGenerationError with the companion error message on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'llm_timeout', message: 'bedrock unavailable' } }),
    }) as unknown as typeof fetch;

    const client = new CompanionClient(testEnv, tokenStub('tok-1'));

    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(
      CompanionGenerationError,
    );
    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(
      /bedrock unavailable/,
    );
  });

  it('falls back to a generic message if the error response is not JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    }) as unknown as typeof fetch;

    const client = new CompanionClient(testEnv, tokenStub('tok-1'));

    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(/HTTP 500/);
  });
});
