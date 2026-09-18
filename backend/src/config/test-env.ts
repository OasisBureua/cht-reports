import type { AppEnv } from '../config/env';

export const testEnv: AppEnv = {
  environment: 'test',
  port: 3000,
  awsRegion: 'us-east-1',
  awsEndpoint: '',
  reportsBucket: 'test-bucket',
  contentHubBaseUrl: 'https://hub.test/api/admin',
  contentHubApiKey: 'hub-key',
  reportRequestsQueueUrl: 'https://sqs.test/queue',
  reportReadyTopicArn: 'arn:aws:sns:test',
  generationStateTable: 'test-generation-state',
  maxGenerationAttempts: 5,
  maxEditAttempts: 3,
  bedrockModelId: 'us.anthropic.claude-sonnet-5',
  companionServiceConnectUrl: 'http://cht-companion:8080',
  companionInternalSecret: 'test-secret',
};