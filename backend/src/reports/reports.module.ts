import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { CompanionClient } from '../companion/companion.client';
import { ContentHubClient } from './packet/content-hub.client';
import { GenerationStateService } from './state/generation-state.service';
import { ReportDocService } from './render/report-doc.service';
import { ReportStorageService } from './storage/report-storage.service';
import { ReportReadyNotifier } from './notify/report-ready.service';
import { ReportGenerationOrchestrator } from './orchestrator';
import { ReportRequestsConsumer } from './consumer';

@Module({
  imports: [ConfigModule, AwsModule],
  providers: [
    CompanionClient,
    ContentHubClient,
    GenerationStateService,
    ReportDocService,
    ReportStorageService,
    ReportReadyNotifier,
    ReportGenerationOrchestrator,
    ReportRequestsConsumer,
  ],
})
export class ReportsModule {}
