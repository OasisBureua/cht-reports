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
  /** cht-reports -> Hub M2M (client_credentials, hub/reports.read). */
  contentHubM2m: {
    clientId: string;
    clientSecret: string;
    tokenUrl: string;
    scope: string;
  };
  reportRequestsQueueUrl: string;
  /**
   * cht-platform-tool API base (e.g. https://devapp.communityhealth.media/api).
   * Platform emails the report's notify list when told a version is ready.
   * Empty: notification is skipped (local dev, tests).
   */
  platformBaseUrl: string;
  /** Scope on the same M2M client for POST /internal/reports/:id/ready. */
  platformNotifyScope: string;
  generationStateTable: string;
  maxGenerationAttempts: number;
  /** Output-token budget per report generation (thinking tokens count toward it). */
  reportMaxOutputTokens: number;
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
    contentHubM2m: {
      clientId: process.env.CONTENTHUB_M2M_CLIENT_ID?.trim() ?? '',
      clientSecret: process.env.CONTENTHUB_M2M_CLIENT_SECRET?.trim() ?? '',
      tokenUrl: process.env.CONTENTHUB_M2M_TOKEN_URL?.trim() ?? '',
      scope: process.env.CONTENTHUB_M2M_SCOPE?.trim() || 'hub/reports.read',
    },
    reportRequestsQueueUrl: required('REPORT_REQUESTS_QUEUE_URL'),
    platformBaseUrl: process.env.PLATFORM_BASE_URL?.trim().replace(/\/+$/, '') ?? '',
    platformNotifyScope: process.env.PLATFORM_REPORTS_NOTIFY_SCOPE?.trim() || 'platform/reports.notify',
    generationStateTable: required('GENERATION_STATE_TABLE'),
    maxGenerationAttempts: Number(process.env.MAX_GENERATION_ATTEMPTS ?? 5),
    reportMaxOutputTokens: Number(process.env.REPORT_MAX_OUTPUT_TOKENS ?? 16000),
    maxEditAttempts: Number(process.env.MAX_EDIT_ATTEMPTS ?? 3),
    bedrockModelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-5',
    companionServiceConnectUrl: process.env.COMPANION_SERVICE_CONNECT_URL ?? 'http://cht-companion:8080',
    companionInternalSecret: required('COMPANION_INTERNAL_SECRET'),
  };
}