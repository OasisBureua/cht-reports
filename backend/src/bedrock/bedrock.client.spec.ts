import { BedrockClient, BedrockGenerationError } from './bedrock.client';
import type { AppEnv } from '../config/env';

const testEnv: AppEnv = {
  environment: 'test',
  port: 3000,
  reportsBucket: 'test-bucket',
  platformToolBaseUrl: 'https://example.test',
  platformToolApiKey: 'test-key',
  reportRequestsQueueUrl: 'https://sqs.test/queue',
  reportReadyTopicArn: 'arn:aws:sns:test',
  generationStateTable: 'test-generation-state',
  maxGenerationAttempts: 5,
  bedrockModelId: 'test-model',
  companionServiceConnectUrl: 'http://cht-companion:8080',
  companionInternalSecret: 'test-secret',
};

describe('BedrockClient', () => {
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

    const client = new BedrockClient(testEnv);
    const result = await client.generate({ systemPrompt: 'System', userContent: 'User content' });

    expect(result).toEqual({ text: 'Generated text.', finishReason: 'complete' });

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
      max_tokens: 4096,
      temperature: undefined,
    });
  });

  it('throws BedrockGenerationError with the companion error message on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({ error: { code: 'llm_timeout', message: 'bedrock unavailable' } }),
    }) as unknown as typeof fetch;

    const client = new BedrockClient(testEnv);

    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(
      BedrockGenerationError,
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

    const client = new BedrockClient(testEnv);

    await expect(client.generate({ systemPrompt: 'System', userContent: 'User' })).rejects.toThrow(/HTTP 500/);
  });
});
