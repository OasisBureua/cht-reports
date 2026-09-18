/**
 * Typed access to the environment variables Terraform wires into the ECS
 * task. Fails fast on boot if something required is missing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface AppEnv {
  environment: string;
  port: number;
  awsRegion: string;
  awsEndpoint: string;
  reportsBucket: string;
  contentHubBaseUrl: string;
  contentHubApiKey: string;
  reportRequestsQueueUrl: string;
  reportReadyTopicArn: string;
  generationStateTable: string;
  maxGenerationAttempts: number;
  maxEditAttempts: number;
  bedrockModelId: string;
  companionServiceConnectUrl: string;
  companionInternalSecret: string;
}

export function loadEnv(): AppEnv {
  return {
    environment: required('ENVIRONMENT'),
    port: Number(process.env.PORT ?? 3000),
    awsRegion: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
    awsEndpoint: process.env.AWS_ENDPOINT ?? '',
    reportsBucket: required('REPORTS_BUCKET'),
    contentHubBaseUrl: required('CONTENTHUB_BASE_URL'),
    contentHubApiKey: process.env.CONTENTHUB_API_KEY ?? '',
    reportRequestsQueueUrl: required('REPORT_REQUESTS_QUEUE_URL'),
    reportReadyTopicArn: required('REPORT_READY_TOPIC_ARN'),
    generationStateTable: required('GENERATION_STATE_TABLE'),
    maxGenerationAttempts: Number(process.env.MAX_GENERATION_ATTEMPTS ?? 5),
    maxEditAttempts: Number(process.env.MAX_EDIT_ATTEMPTS ?? 3),
    bedrockModelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-5',
    companionServiceConnectUrl: process.env.COMPANION_SERVICE_CONNECT_URL ?? 'http://cht-companion:8080',
    companionInternalSecret: required('COMPANION_INTERNAL_SECRET'),
  };
}