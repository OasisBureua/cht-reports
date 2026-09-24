/**
 * Renders a generated Executive Summary report to HTML. Matches CPR-18's
 * two priority template variants (pre-record + webinar, webinar-only).
 * Pre-record-only and multi-webinar-in-one-report are real but lower
 * priority, not built here yet.
 *
 * HTML instead of DOCX: CPR-18's confirmed section list includes a
 * chart-per-question survey results section, which HTML renders natively
 * (inline SVG) without the embedded-image workarounds DOCX chart support
 * requires.
 *
 * This is a minimal, working skeleton, not a finished template. The real
 * design work (matching CHM's actual report styling and branding) is
 * separate scope from getting a first real HTML report out of the
 * pipeline end to end. It does not yet cover the full 13-section
 * structure confirmed in CPR-18 (KOLs, attendees table, Q&A-driven
 * sections, survey charts) — those need `ExecutiveSummaryContent` to grow
 * beyond title/variant/sections/inputCompletenessNote first, which is
 * CPR-18/19 follow-on scope, not this change.
 */

import { Injectable } from '@nestjs/common';

export interface ExecutiveSummarySection {
  heading: string;
  paragraphs: string[];
}

export interface ExecutiveSummaryContent {
  title: string;
  variant: 'pre_record_and_webinar' | 'webinar_only' | 'pre_record_only';
  sections: ExecutiveSummarySection[];
  inputCompletenessNote: string | null;
}

@Injectable()
export class ReportDocService {
  async renderExecutiveSummary(content: ExecutiveSummaryContent): Promise<string> {
    const sectionsHtml = content.sections
      .map(
        (section) => `
      <section>
        <h2>${escapeHtml(section.heading)}</h2>
        ${section.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n        ')}
      </section>`,
      )
      .join('\n');

    const inputCompletenessHtml = content.inputCompletenessNote
      ? `
      <section class="input-completeness">
        <h2>Input Completeness</h2>
        <p><em>${escapeHtml(content.inputCompletenessNote)}</em></p>
      </section>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(content.title)}</title>
  <style>${REPORT_STYLES}</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(content.title)}</h1>
${sectionsHtml}
${inputCompletenessHtml}
  </main>
</body>
</html>
`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const REPORT_STYLES = `
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; }
  h1 { font-size: 28px; margin-bottom: 32px; }
  h2 { font-size: 20px; margin-top: 40px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  p { font-size: 16px; margin: 16px 0; }
  .input-completeness p { color: #555; }
`;
