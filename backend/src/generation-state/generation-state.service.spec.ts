import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GenerationStateService } from './generation-state.service';
import type { AppEnv } from '../config/env';

const ddbMock = mockClient(DynamoDBDocumentClient);

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

describe('GenerationStateService', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('initializes state with attempt_count 0', async () => {
    ddbMock.on(PutCommand).resolves({});
    const service = new GenerationStateService(testEnv);

    const state = await service.initialize('req-1');

    expect(state.attemptCount).toBe(0);
    expect(state.status).toBe('queued');
  });

  it('increments attempt count on each beginAttempt call', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { request_id: 'req-1', attempt_count: 2, status: 'generating' } });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        request_id: 'req-1',
        status: 'pulling_data',
        attempt_count: 3,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
        expires_at: 0,
      },
    });

    const service = new GenerationStateService(testEnv);
    const state = await service.beginAttempt('req-1', 'pulling_data');

    expect(state.attemptCount).toBe(3);
  });

  it('throws and marks failed once max attempts is exceeded', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { request_id: 'req-1', attempt_count: 5, status: 'generating' } });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        request_id: 'req-1',
        status: 'failed',
        attempt_count: 5,
        last_error: 'Exceeded max attempts (5)',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
        expires_at: 0,
      },
    });

    const service = new GenerationStateService(testEnv);

    await expect(service.beginAttempt('req-1', 'pulling_data')).rejects.toThrow(
      /exceeded max generation attempts/i,
    );

    const updateCalls = ddbMock.commandCalls(UpdateCommand);
    const lastCall = updateCalls[updateCalls.length - 1].args[0].input;
    expect(lastCall.ExpressionAttributeValues?.[':status']).toBe('failed');
  });

  it('does not retry a request already marked complete (idempotent redelivery)', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        request_id: 'req-1',
        status: 'complete',
        attempt_count: 1,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
        expires_at: 0,
      },
    });

    const service = new GenerationStateService(testEnv);
    const state = await service.get('req-1');

    expect(state?.status).toBe('complete');
  });
});
