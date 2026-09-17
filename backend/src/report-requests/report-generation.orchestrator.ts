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
import { PlatformToolClient, ReportInputPacket } from '../platform-tool/platform-tool.client';
import { BedrockClient } from '../bedrock/bedrock.client';
import { ReportDocService, ExecutiveSummaryContent } from '../report-doc/report-doc.service';
import { ReportStorageService } from '../s3/report-storage.service';
import { ReportReadyNotifier } from '../notify/report-ready.service';
import { GenerationStateService } from '../generation-state/generation-state.service';
import { cleanTranscriptText, splitPrerecordedLivestream } from '../preprocessing/transcript';

export interface ReportRequest {
  requestId: string;
  // cuid() string, matching cht-platform-tool's Program.id, not a numeric
  // id. See platform-tool.client.ts: campaign-to-program linkage itself is
  // still an open question (Program has no campaignId field today).
  campaignId: string;
}

@Injectable()
export class ReportGenerationOrchestrator {
  private readonly logger = new Logger(ReportGenerationOrchestrator.name);

  constructor(
    private readonly platformTool: PlatformToolClient,
    private readonly bedrock: BedrockClient,
    private readonly reportDoc: ReportDocService,
    private readonly storage: ReportStorageService,
    private readonly notifier: ReportReadyNotifier,
    private readonly state: GenerationStateService,
  ) {}

  async handle(request: ReportRequest): Promise<void> {
    const { requestId, campaignId } = request;

    let existing = await this.state.get(requestId);
    if (!existing) {
      existing = await this.state.initialize(requestId);
    }
    if (existing.status === 'complete') {
      this.logger.log(`Request ${requestId} already complete, skipping (idempotent redelivery)`);
      return;
    }

    try {
      await this.state.beginAttempt(requestId, 'pulling_data');
      const packet = await this.platformTool.fetchReportInputPacket(campaignId);

      await this.state.markStatus(requestId, 'generating');
      const content = await this.generateContent(packet);

      await this.state.markStatus(requestId, 'rendering');
      const docxBuffer = await this.reportDoc.renderExecutiveSummary(content);

      await this.state.markStatus(requestId, 'uploading');
      const s3Key = await this.storage.uploadReport(requestId, docxBuffer);

      await this.notifier.notify({ requestId, campaignId, s3Key });
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
   * Assembles a report-generation prompt from the input packet and calls
   * out to cht-companion's /generate for the completion. Preprocessing
   * (filler-word cleaning, pre-record/livestream split) happens here, not
   * in platform-tool.client.ts, so the raw transcript text cht-platform-tool
   * returns stays untouched for anyone else who reads it later.
   */
  private async generateContent(packet: ReportInputPacket): Promise<ExecutiveSummaryContent> {
    const cleanedSessions = packet.sessions.map((session) => {
      const cleaned = cleanTranscriptText(session.transcriptText);
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
          `Session: ${s.title ?? s.platformToolProgramId}\n${s.prerecorded}${s.livestream ? `\n\nQ&A:\n${s.livestream}` : ''}`,
      )
      .join('\n\n---\n\n');

    const surveyContext = packet.surveyResponses.map((r) => JSON.stringify(r.answers)).join('\n');

    const result = await this.bedrock.generate({
      systemPrompt: EXECUTIVE_SUMMARY_SYSTEM_PROMPT,
      userContent: `Transcripts:\n${transcriptContext}\n\nSurvey responses:\n${surveyContext}`,
    });

    const missingSources = Object.entries(packet.inputCompleteness)
      .filter(([, v]) => v.status !== 'ok')
      .map(([source, v]) => `${source}: ${v.status}`);

    return {
      title: `Executive Summary: Campaign ${packet.campaignId}`,
      variant,
      sections: parseGeneratedSections(result.text),
      inputCompletenessNote:
        missingSources.length > 0
          ? `The following sources were unavailable or incomplete when this report was generated: ${missingSources.join(', ')}.`
          : null,
    };
  }
}

const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You are generating an Executive Summary report for a CHM medical education campaign. Use only the transcript and survey data provided. Do not invent data not present in the input.`;

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
