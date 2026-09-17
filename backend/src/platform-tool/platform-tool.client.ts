/**
 * Client for pulling report-input data (Zoom sessions, attendance,
 * transcripts, survey responses) from cht-platform-tool's export contract.
 *
 * This data lives in cht-platform-tool's database (Program, Survey,
 * SurveyResponse, WebinarParticipantEvent, ZoomRecordingFile), not Content
 * Hub. Content Hub holds cht-reports' own reports.* schema; it is not the
 * source of this input data.
 *
 * Not yet real. CPR-13/CPR-14's export contract is proposed but not built
 * on cht-platform-tool's side: one bulk endpoint,
 * GET /api/export/reports/campaigns/:campaignId/input-packet. This client
 * is written against that proposal so the rest of the pipeline can be
 * built and tested now. Swap in the real shape once CPR-13/14 land.
 *
 * Open blocker: Program has no campaignId field anywhere in
 * cht-platform-tool's schema. Either that schema gains one, or cht-reports
 * does its own program-to-campaign matching (the same problem CPR-5 has
 * for survey-to-webinar matching). This client's campaignId param assumes
 * that's resolved by the time this is real.
 *
 * Auth: CPR-12 (Cognito M2M, client_credentials, platform/export.read
 * scope) is the intended mechanism, not a plain API key.
 *
 * Reached over plain HTTPS, not Service Connect. cht-platform-tool runs
 * its own separate ECS cluster and VPC with no shared namespace, see
 * infrastructure/terraform/modules/compute/ecs-cluster.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import { APP_ENV } from '../config/config.module';

export interface SessionData {
  platformToolProgramId: string;
  kind: 'pre_record' | 'webinar' | 'live_event';
  title: string | null;
  sessionDate: string | null;
  zoomMeetingUuid: string | null;
  transcriptText: string;
}

export interface SurveyResponseData {
  respondentId: string;
  source: 'native' | 'jotform';
  surveyType: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK' | 'INTAKE';
  submittedAt: string;
  answers: Record<string, unknown>;
}

export interface ReportInputPacket {
  campaignId: string;
  sessions: SessionData[];
  surveyResponses: SurveyResponseData[];
  // Per REP-GEN-002 / CPR-19: records which sources were actually fetched
  // vs. missing, so gaps surface in the generated report rather than
  // silently producing an incomplete document.
  inputCompleteness: Record<string, { fetchedAt: string; rowCount: number; status: 'ok' | 'missing' | 'error' }>;
}

export class PlatformToolClientError extends Error {}

@Injectable()
export class PlatformToolClient {
  private readonly logger = new Logger(PlatformToolClient.name);

  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  async fetchReportInputPacket(campaignId: string): Promise<ReportInputPacket> {
    // Stub: CPR-13/14's export contract isn't built yet on cht-platform-tool's
    // side, and the campaignId-linkage blocker (see header comment) isn't
    // resolved. Throwing loudly rather than returning fake data, so a real
    // integration test fails clearly instead of silently generating a
    // report from nothing.
    throw new PlatformToolClientError(
      `cht-platform-tool export contract not yet implemented (campaignId=${campaignId}). ` +
        'Pending CPR-13 (Zoom export consumption) and CPR-14 (survey ingest); see platform-tool.client.ts header comment.',
    );

    // Real implementation, once CPR-13/14 land:
    //
    // const response = await fetch(
    //   `${this.env.platformToolBaseUrl}/api/export/reports/campaigns/${campaignId}/input-packet`,
    //   { headers: { Authorization: `Bearer ${await this.getM2mToken()}` } },
    // );
    //
    // if (!response.ok) {
    //   const body = await response.text();
    //   this.logger.error({ status: response.status, campaignId }, 'platform-tool input-packet fetch failed');
    //   throw new PlatformToolClientError(`cht-platform-tool returned ${response.status}: ${body}`);
    // }
    //
    // return response.json();
  }
}
