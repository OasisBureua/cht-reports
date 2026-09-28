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
import { BUILTIN_HTML_TEMPLATE } from '../templates/builtin';

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
  /**
   * Fill the HTML skeleton (CPR-25 template, or the built-in one) with the
   * generated content. Placeholders: {{title}}, {{sections}},
   * {{inputCompleteness}}. All inserted text is HTML-escaped.
   */
  async renderExecutiveSummary(
    content: ExecutiveSummaryContent,
    htmlTemplate: string = BUILTIN_HTML_TEMPLATE,
  ): Promise<string> {
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

    return fill(htmlTemplate, {
      title: escapeHtml(content.title),
      sections: sectionsHtml,
      inputCompleteness: inputCompletenessHtml,
    });
  }
}

/**
 * Single pass over the template: inserted content is never re-scanned for
 * placeholders, and a function replacer keeps `$` in content literal.
 * Unknown placeholders are left as-is.
 */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match,
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
