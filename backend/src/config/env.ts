/**
 * Typed access to the environment variables Terraform wires into the ECS
 * task (see infrastructure/terraform/environments/us-east-1/main.tf,
 * module.ecs_backend.environment_variables and .secret_arns). Fails fast
 * on boot if something required is missing, rather than surfacing a
 * confusing error mid-request.
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
  reportsBucket: string;
  platformToolBaseUrl: string;
  platformToolApiKey: string;
  reportRequestsQueueUrl: string;
  reportReadyTopicArn: string;
  generationStateTable: string;
  maxGenerationAttempts: number;
  bedrockModelId: string;
  companionServiceConnectUrl: string;
  companionInternalSecret: string;
}

export function loadEnv(): AppEnv {
  return {
    environment: required('ENVIRONMENT'),
    port: Number(process.env.PORT ?? 3000),
    reportsBucket: required('REPORTS_BUCKET'),
    // This is cht-platform-tool, not Content Hub. See platform-tool.client.ts
    // header comment. PLATFORM_TOOL_API_KEY is a placeholder pending CPR-12's
    // Cognito M2M client_credentials flow; a plain API key is not the real
    // auth mechanism once that's built.
    platformToolBaseUrl: required('PLATFORM_TOOL_BASE_URL'),
    platformToolApiKey: process.env.PLATFORM_TOOL_API_KEY ?? '',
    reportRequestsQueueUrl: required('REPORT_REQUESTS_QUEUE_URL'),
    reportReadyTopicArn: required('REPORT_READY_TOPIC_ARN'),
    generationStateTable: required('GENERATION_STATE_TABLE'),
    maxGenerationAttempts: Number(process.env.MAX_GENERATION_ATTEMPTS ?? 5),
    // Same model cht-companion uses (backend/api/bedrock.py), reached over
    // Service Connect. cht-companion's own Bedrock invoke wraps auth and
    // logging cht-reports doesn't need to reimplement. See bedrock/ module
    // notes for why this calls out to cht-companion rather than invoking
    // Bedrock directly.
    bedrockModelId: process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-5',
    companionServiceConnectUrl: process.env.COMPANION_SERVICE_CONNECT_URL ?? 'http://cht-companion:8080',
    companionInternalSecret: required('COMPANION_INTERNAL_SECRET'),
  };
}
