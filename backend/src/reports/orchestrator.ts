/**
 * Report-generation orchestration: take a request, pull data, generate,
 * format, deposit in S3, notify.
 *
 * Retry semantics: each stage is idempotent to re-run (pulling data again,
 * generating again, uploading to the same deterministic S3 key again all
 * produce the same or a strictly improving result), so on failure the
 * whole request is retried from the top rather than resumed mid-pipeline.
 * GenerationStateService caps this at MAX_GENERATION_ATTEMPTS (5) and
 * marks the request failed rather than retrying forever.
 */

import { Injectable, Logger } from '@nestjs/common';
import { CompanionClient } from '../companion/companion.client';
import { ContentHubClient } from './packet/content-hub.client';
import type { ReportInputPacket } from './packet/report-packet.types';
import { ReportDocService, ExecutiveSummaryContent } from './render/report-doc.service';
import { ReportStorageService } from './storage/report-storage.service';
import { ReportReadyNotifier } from './notify/report-ready.service';
import { GenerationStateService } from './state/generation-state.service';
import { cleanTranscriptText, splitPrerecordedLivestream } from './preprocess/transcript';

export interface ReportRequest {
  requestId: string;
  campaignId: string;
}

@Injectable()
export class ReportGenerationOrchestrator {
  private readonly logger = new Logger(ReportGenerationOrchestrator.name);

  constructor(
    private readonly contentHub: ContentHubClient,
    private readonly companion: CompanionClient,
    private readonly reportDoc: ReportDocService,
    private readonly storage: ReportStorageService,
    private readonly notifier: ReportReadyNotifier,
    private readonly state: GenerationStateService,
  ) {}

  async handle(request: ReportRequest): Promise<void> {
    const { requestId } = request;

    let existing = await this.state.get(requestId, request.campaignId || undefined);
    if (!existing) {
      if (!request.campaignId) {
        throw new Error(`Request ${requestId} has no state row and no campaignId; cannot start`);
      }
      existing = await this.state.initialize(requestId, request.campaignId);
    }
    if (existing.status === 'complete') {
      this.logger.log(`Request ${requestId} already complete, skipping (idempotent redelivery)`);
      return;
    }

    const campaignId = existing.campaignId;

    try {
      await this.state.beginAttempt(requestId, 'pulling_data');
      const packet = await this.contentHub.fetchReportPacket({
        campaignId,
        windowStart: existing.windowStart,
        windowEnd: existing.windowEnd,
        sources: existing.sources,
      });

      await this.state.markStatus(requestId, 'generating');
      const content = await this.generateContent(packet);

      await this.state.markStatus(requestId, 'rendering');
      const html = await this.reportDoc.renderExecutiveSummary(content);

      await this.state.markStatus(requestId, 'uploading');
      const s3Key = await this.storage.uploadReport(requestId, html);

      await this.notifier.notify({ requestId, campaignId: String(campaignId), s3Key });
      await this.state.markComplete(requestId);

      this.logger.log(`Request ${requestId} complete: ${s3Key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Request ${requestId} failed: ${message}`);
      await this.state.markFailed(requestId, message);
      throw err;
    }
  }

  /**
   * Assembles a report-generation prompt from the Content Hub packet and
   * calls cht-companion `/generate`. Filler-word cleaning and
   * pre-record/livestream split happen here. Hub already ETL'd the warehouse
   * copy; this path never queries Aurora or cht-platform-tool.
   */
  private async generateContent(packet: ReportInputPacket): Promise<ExecutiveSummaryContent> {
    const cleanedSessions = packet.sessions.map((session) => {
      const cleaned = cleanTranscriptText(session.transcriptText ?? '');
      const { prerecorded, livestream } = splitPrerecordedLivestream(cleaned);
      return { ...session, prerecorded, livestream };
    });

    const hasLivestream = cleanedSessions.some((s) => s.livestream !== null);
    const hasPrerecorded = cleanedSessions.some((s) => s.prerecorded.trim().length > 0);
    const variant: ExecutiveSummaryContent['variant'] =
      hasPrerecorded && hasLivestream
        ? 'pre_record_and_webinar'
        : hasLivestream
          ? 'webinar_only'
          : 'pre_record_only';

    const transcriptContext = cleanedSessions
      .map(
        (s) =>
          `Session: ${s.title ?? s.platformToolProgramId ?? 'untitled'}\n${s.prerecorded}${s.livestream ? `\n\nQ&A:\n${s.livestream}` : ''}`,
      )
      .join('\n\n---\n\n');

    const surveyContext = packet.surveyResponses.map((r) => JSON.stringify(r.answers)).join('\n');
    const platformContext = (packet.platformSlices ?? [])
      .map((slice) => `${slice.platform} ${slice.fetchDate} (${slice.status}): ${JSON.stringify(slice.rows)}`)
      .join('\n');
    const hubspotContext = packet.hubspotRawData ? JSON.stringify(packet.hubspotRawData) : '';

    const result = await this.companion.generate({
      systemPrompt: EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      userContent: `Transcripts:\n${transcriptContext}\n\nSurvey responses:\n${surveyContext}\n\nPlatform metrics:\n${platformContext}\n\nHubSpot:\n${hubspotContext}`,
      temperature: 0.2,
    });

    const missingSources = Object.entries(packet.inputCompleteness)
      .filter(([, v]) => v.status !== 'ok')
      .map(([source, v]) => `${source}: ${v.status}`);

    return {
      title: `Executive Summary: ${packet.campaignName ?? `Campaign ${packet.campaignId}`}`,
      variant,
      sections: parseGeneratedSections(result.text),
      inputCompletenessNote:
        missingSources.length > 0
          ? `The following sources were unavailable or incomplete when this report was generated: ${missingSources.join(', ')}.`
          : null,
    };
  }
}

const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You are generating an Executive Summary report for a CHM medical education campaign. Use only the transcript, survey, platform metric, and HubSpot data provided. Do not invent data not present in the input.`;

/**
 * Placeholder section parser. Real output-structure parsing (headline/body
 * extraction, refusal-detection guards) is a real piece of work the prior
 * MediaHub pipeline solved (pipeline.py's _extract_section /
 * _filter_refusal_items) and is not ported yet. cht-companion's /generate
 * returns real text; this function does not do anything with its
 * structure beyond wrapping it in one section.
 */
function parseGeneratedSections(text: string): ExecutiveSummaryContent['sections'] {
  return [{ heading: 'Executive Summary', paragraphs: [text] }];
}
