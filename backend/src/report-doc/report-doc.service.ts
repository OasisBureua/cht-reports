/**
 * Renders a generated Executive Summary report to DOCX. Matches CPR-18's
 * two priority template variants (pre-record + webinar, webinar-only).
 * Pre-record-only and multi-webinar-in-one-report are real but lower
 * priority, not built here yet.
 *
 * This is a minimal, working skeleton, not a finished template. The real
 * design work (matching CHM's actual report styling and branding) is
 * separate scope from getting a first real DOCX out of the pipeline end
 * to end.
 */

import { Injectable } from '@nestjs/common';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';

export interface ExecutiveSummarySection {
  heading: string;
  paragraphs: string[];
}

export interface ExecutiveSummaryContent {
  title: string;
  variant: 'pre_record_and_webinar' | 'webinar_only' | 'pre_record_only';
  sections: ExecutiveSummarySection[];
  // Per REP-GEN-002: surfaced as a final section so gaps in the input
  // packet are visible in the delivered document, not just in logs.
  inputCompletenessNote: string | null;
}

@Injectable()
export class ReportDocService {
  async renderExecutiveSummary(content: ExecutiveSummaryContent): Promise<Buffer> {
    const children: Paragraph[] = [
      new Paragraph({
        text: content.title,
        heading: HeadingLevel.TITLE,
      }),
    ];

    for (const section of content.sections) {
      children.push(
        new Paragraph({
          text: section.heading,
          heading: HeadingLevel.HEADING_1,
        }),
      );
      for (const paragraphText of section.paragraphs) {
        children.push(new Paragraph({ children: [new TextRun(paragraphText)] }));
      }
    }

    if (content.inputCompletenessNote) {
      children.push(
        new Paragraph({
          text: 'Input Completeness',
          heading: HeadingLevel.HEADING_2,
        }),
        new Paragraph({
          children: [new TextRun({ text: content.inputCompletenessNote, italics: true })],
        }),
      );
    }

    const doc = new Document({
      sections: [{ children }],
    });

    return Packer.toBuffer(doc);
  }
}
