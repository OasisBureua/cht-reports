/**
 * All AWS SDK clients for this process, created at runtime from env
 * (region / optional endpoint). Inject this instead of `new S3Client({})`
 * in feature services.
 */

import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

@Injectable()
export class AwsClients implements OnModuleDestroy {
  private readonly cfg: { region: string; endpoint?: string };
  private s3Client?: S3Client;
  private sqsClient?: SQSClient;
  private snsClient?: SNSClient;
  private dynamodbLow?: DynamoDBClient;
  private dynamodbDoc?: DynamoDBDocumentClient;

  constructor(@Inject(APP_ENV) env: AppEnv) {
    this.cfg = { region: env.awsRegion };
    if (env.awsEndpoint) {
      this.cfg.endpoint = env.awsEndpoint;
    }
  }

  get s3(): S3Client {
    return (this.s3Client ??= new S3Client(this.cfg));
  }

  get sqs(): SQSClient {
    return (this.sqsClient ??= new SQSClient(this.cfg));
  }

  get sns(): SNSClient {
    return (this.snsClient ??= new SNSClient(this.cfg));
  }

  get dynamodb(): DynamoDBDocumentClient {
    if (!this.dynamodbDoc) {
      this.dynamodbLow = new DynamoDBClient(this.cfg);
      this.dynamodbDoc = DynamoDBDocumentClient.from(this.dynamodbLow, {
        marshallOptions: { removeUndefinedValues: true },
      });
    }
    return this.dynamodbDoc;
  }

  onModuleDestroy(): void {
    this.s3Client?.destroy();
    this.sqsClient?.destroy();
    this.snsClient?.destroy();
    this.dynamodbLow?.destroy();
  }
}