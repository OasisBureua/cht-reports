import type { AppEnv } from '../config/env';

export const testEnv: AppEnv = {
  environment: 'test',
  port: 3000,
  awsRegion: 'us-east-1',
  awsEndpoint: '',
  reportsBucket: 'test-bucket',
  contentHubBaseUrl: 'https://hub.test/api/admin',
  contentHubM2m: {
    clientId: 'test-client',
    clientSecret: 'test-client-secret',
    tokenUrl: 'https://auth.test/oauth2/token',
    scope: 'hub/reports.read',
  },
  reportRequestsQueueUrl: 'https://sqs.test/queue',
  platformBaseUrl: 'https://platform.test/api',
  platformNotifyScope: 'platform/reports.notify',
  generationStateTable: 'test-generation-state',
  maxGenerationAttempts: 3,
  transcriptRecentHours: 24,
  transcriptWaitMaxMinutes: 180,
  transcriptRecheckSeconds: 300,
  reportMaxOutputTokens: 16000,
  maxEditAttempts: 3,
  bedrockModelId: 'us.anthropic.claude-sonnet-5',
  companionServiceConnectUrl: 'http://cht-companion:8080',
  companionInternalSecret: 'test-secret',
};