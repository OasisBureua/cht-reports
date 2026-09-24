import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GenerationStateService, REPORT_ID_INDEX } from './generation-state.service';
import { AwsClients } from '../../aws/aws-clients';
import { testEnv } from '../../config/test-env';

const ddbMock = mockClient(DynamoDBDocumentClient);

function service(): GenerationStateService {
  const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
  return new GenerationStateService(testEnv, { dynamodb } as unknown as AwsClients);
}

describe('GenerationStateService', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('initializes state with attempt_count 0', async () => {
    ddbMock.on(PutCommand).resolves({});
    const state = await service().initialize('req-1', '9');

    expect(state.attemptCount).toBe(0);
    expect(state.status).toBe('queued');
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(item).toMatchObject({ campaign_id: '9', report_id: 'req-1' });
  });

  it('increments attempt count on each beginAttempt call', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', attempt_count: 2, status: 'generating' }] });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        report_id: 'req-1',
        status: 'pulling_data',
        attempt_count: 3,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    const state = await service().beginAttempt('req-1', 'pulling_data');

    expect(state.attemptCount).toBe(3);
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.Key).toEqual({ campaign_id: '9', report_id: 'req-1' });
  });

  it('throws and marks failed once max attempts is exceeded', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', attempt_count: 5, status: 'generating' }] });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        report_id: 'req-1',
        status: 'failed',
        attempt_count: 5,
        last_error: 'Exceeded max attempts (5)',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    await expect(service().beginAttempt('req-1', 'pulling_data')).rejects.toThrow(
      /exceeded max generation attempts/i,
    );

    const updateCalls = ddbMock.commandCalls(UpdateCommand);
    const lastCall = updateCalls[updateCalls.length - 1].args[0].input;
    expect(lastCall.ExpressionAttributeValues?.[':status']).toBe('failed');
  });

  it('does not retry a request already marked complete (idempotent redelivery)', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        campaign_id: '9',
        report_id: 'req-1',
        status: 'complete',
        attempt_count: 1,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    const state = await service().get('req-1', '9');

    expect(state?.status).toBe('complete');
    const get = ddbMock.commandCalls(GetCommand)[0].args[0].input;
    expect(get.Key).toEqual({ campaign_id: '9', report_id: 'req-1' });
    expect(get.ConsistentRead).toBe(true);
  });

  it('looks a report up by id alone through the report_id index', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', status: 'queued', attempt_count: 0 }] });

    const state = await service().get('req-1');

    expect(state?.campaignId).toBe('9');
    const query = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(query.IndexName).toBe(REPORT_ID_INDEX);
  });

  it('returns null when the report has no row', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    expect(await service().get('missing')).toBeNull();
  });
});
