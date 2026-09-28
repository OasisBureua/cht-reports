import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { AwsModule } from '../aws/aws.module';
import { CompanionClient } from '../companion/companion.client';
import { ContentHubClient } from './packet/content-hub.client';
import { GenerationStateService } from './state/generation-state.service';
import { ChromiumPdfPrinter } from './render/chromium-pdf-printer';
import { PDF_PRINTER } from './render/pdf-printer';
import { ReportDocService } from './render/report-doc.service';
import { ReportStorageService } from './storage/report-storage.service';
import { ReportReadyNotifier } from './notify/report-ready.service';
import { ReportGenerationOrchestrator } from './orchestrator';
import { ReportRequestsConsumer } from './consumer';
import { TemplateStore } from './templates/template-store.service';
import { CognitoM2mTokenService } from '../auth/cognito-m2m-token.service';

@Module({
  imports: [ConfigModule, AwsModule],
  providers: [
    CompanionClient,
    ContentHubClient,
    GenerationStateService,
    ReportDocService,
    { provide: PDF_PRINTER, useClass: ChromiumPdfPrinter },
    ReportStorageService,
    ReportReadyNotifier,
    ReportGenerationOrchestrator,
    ReportRequestsConsumer,
    TemplateStore,
    CognitoM2mTokenService,
  ],
})
export class ReportsModule {}
