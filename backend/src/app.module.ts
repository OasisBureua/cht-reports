import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ConfigModule } from './config/config.module';
import { PlatformToolClient } from './platform-tool/platform-tool.client';
import { BedrockClient } from './bedrock/bedrock.client';
import { ReportDocService } from './report-doc/report-doc.service';
import { ReportStorageService } from './s3/report-storage.service';
import { ReportReadyNotifier } from './notify/report-ready.service';
import { GenerationStateService } from './generation-state/generation-state.service';
import { ReportGenerationOrchestrator } from './report-requests/report-generation.orchestrator';
import { ReportRequestsConsumer } from './report-requests/report-requests.consumer';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [
    PlatformToolClient,
    BedrockClient,
    ReportDocService,
    ReportStorageService,
    ReportReadyNotifier,
    GenerationStateService,
    ReportGenerationOrchestrator,
    ReportRequestsConsumer,
  ],
})
export class AppModule {}
