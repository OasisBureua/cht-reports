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

  it('reads a row written before statuses were uppercase', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ campaign_id: '9', report_id: 'req-1', attempt_count: 1, status: 'waiting_for_transcript' }],
    });
    const state = await service().get('req-1');
    expect(state?.status).toBe('WAITING_FOR_TRANSCRIPT');
  });

  it('initializes state with attempt_count 0', async () => {
    ddbMock.on(PutCommand).resolves({});
    const state = await service().initialize('req-1', '9');

    expect(state.attemptCount).toBe(0);
    expect(state.status).toBe('QUEUED');
    const item = ddbMock.commandCalls(PutCommand)[0].args[0].input.Item;
    expect(item).toMatchObject({ campaign_id: '9', report_id: 'req-1' });
  });

  it('increments attempt count on each beginAttempt call', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', attempt_count: 2, status: 'GENERATING' }] });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        report_id: 'req-1',
        status: 'PULLING_DATA',
        attempt_count: 3,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    const state = await service().beginAttempt('req-1', 'PULLING_DATA');

    expect(state.attemptCount).toBe(3);
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.Key).toEqual({ campaign_id: '9', report_id: 'req-1' });
  });

  it('throws and marks failed once max attempts is exceeded', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', attempt_count: 5, status: 'GENERATING' }] });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        report_id: 'req-1',
        status: 'FAILED',
        attempt_count: 5,
        last_error: 'Exceeded max attempts (5)',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    await expect(service().beginAttempt('req-1', 'PULLING_DATA')).rejects.toThrow(
      /exceeded max generation attempts/i,
    );

    const updateCalls = ddbMock.commandCalls(UpdateCommand);
    const lastCall = updateCalls[updateCalls.length - 1].args[0].input;
    expect(lastCall.ExpressionAttributeValues?.[':status']).toBe('FAILED');
  });

  it('does not retry a request already marked complete (idempotent redelivery)', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        campaign_id: '9',
        report_id: 'req-1',
        status: 'COMPLETE',
        attempt_count: 1,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    const state = await service().get('req-1', '9');

    expect(state?.status).toBe('COMPLETE');
    const get = ddbMock.commandCalls(GetCommand)[0].args[0].input;
    expect(get.Key).toEqual({ campaign_id: '9', report_id: 'req-1' });
    expect(get.ConsistentRead).toBe(true);
  });

  it('looks a report up by id alone through the report_id index', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [{ campaign_id: '9', report_id: 'req-1', status: 'QUEUED', attempt_count: 0 }] });

    const state = await service().get('req-1');

    expect(state?.campaignId).toBe('9');
    const query = ddbMock.commandCalls(QueryCommand)[0].args[0].input;
    expect(query.IndexName).toBe(REPORT_ID_INDEX);
  });

  it('returns null when the report has no row', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    expect(await service().get('missing')).toBeNull();
  });

  it('sets s3_key_pdf on the same UpdateItem as status=complete', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ campaign_id: '9', report_id: 'req-1', status: 'UPLOADING', attempt_count: 1 }],
    });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        campaign_id: '9',
        report_id: 'req-1',
        status: 'COMPLETE',
        s3_key_pdf: 'reports/9/req-1/v1.pdf',
        attempt_count: 1,
        last_error: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:01.000Z',
      },
    });

    const state = await service().markComplete('req-1', 'reports/9/req-1/v1.pdf', 1);

    expect(state.status).toBe('COMPLETE');
    expect(state.s3KeyPdf).toBe('reports/9/req-1/v1.pdf');
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.ExpressionAttributeValues?.[':status']).toBe('COMPLETE');
    expect(update.ExpressionAttributeValues?.[':s3_key_pdf']).toBe('reports/9/req-1/v1.pdf');
    expect(update.ExpressionAttributeValues?.[':version']).toBe(1);
    expect(update.UpdateExpression).toContain('#version = :version');
  });

  it('markWaiting parks the job, keeps the first waiting_since, and gives back the attempt', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [{ campaign_id: '9', report_id: 'req-1', status: 'PULLING_DATA', attempt_count: 2 }],
    });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: {
        campaign_id: '9',
        report_id: 'req-1',
        status: 'WAITING_FOR_TRANSCRIPT',
        attempt_count: 1,
        waiting_since: '2026-10-15T20:00:00.000Z',
        created_at: '2026-10-15T19:00:00.000Z',
        updated_at: '2026-10-15T20:00:00.000Z',
      },
    });

    const state = await service().markWaiting('req-1');

    expect(state.status).toBe('WAITING_FOR_TRANSCRIPT');
    expect(state.waitingSince).toBe('2026-10-15T20:00:00.000Z');
    const update = ddbMock.commandCalls(UpdateCommand)[0].args[0].input;
    expect(update.UpdateExpression).toContain('waiting_since = if_not_exists(waiting_since, :now)');
    expect(update.ExpressionAttributeValues?.[':attempts']).toBe(1);
    expect(update.ExpressionAttributeValues?.[':waiting']).toBe('WAITING_FOR_TRANSCRIPT');
  });
});
