import { CompanionClient, CompanionGenerationError } from './companion.client';
import { testEnv } from '../config/test-env';

describe('CompanionClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls companion /generate with the expected request shape', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ text: 'Generated text.', finish_reason: 'complete', request_id: 'req-1' }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const client = new CompanionClient(testEnv);
    const result = await client.generate({ systemPrompt: 'System', userContent: 'User content' });

    expect(result).toEqual({ text: 'Generated text.', finishReason: 'complete', tokensInput: undefined, tokensOutput: undefined });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://cht-companion:8080/generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-BFF-Auth': 'test-secret',
          'Content-Type': 'application/json',
          'X-Client': 'cht-reports',
        }),
      }),
    );

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

    const client = new CompanionClient({ ...testEnv, reportMaxOutputTokens: 24000 });
    const result = await client.generate({ systemPrompt: 'S', userContent: 'U' });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body).max_tokens).toBe(24000);
    expect(result).toEqual({ text: 'T', finishReason: 'truncated', tokensInput: 23571, tokensOutput: 8192 });
  });

  it('throws CompanionGenerationError with the companion error message on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'llm_timeout', message: 'bedrock unavailable' } }),
    }) as unknown as typeof fetch;

    const client = new CompanionClient(testEnv);

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

    const client = new CompanionClient(testEnv);

    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(/HTTP 500/);
  });
});
