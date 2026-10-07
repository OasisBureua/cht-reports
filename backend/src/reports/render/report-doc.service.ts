/**
 * Renders an Executive Summary to HTML (CPR-18: the 13-section structure
 * confirmed against the AstraZeneca DB-09 and Daiichi Sankyo reports).
 *
 * The template (CPR-25, or the built-in one) owns page styling and
 * placement through four placeholders: {{title}}, {{cover}}, {{sections}},
 * {{inputCompleteness}}. This service owns section markup. Sections with
 * nothing to show are left out and named in the input-completeness note,
 * so a report never shows an empty heading. `sections` limits which
 * sections render (CPR-18: toggleable without a new template version).
 */

import { Injectable } from '@nestjs/common';
import { BUILTIN_HTML_TEMPLATE } from '../templates/builtin';
import type {
  AttendeesSummary,
  Claim,
  CountRow,
  ExecutiveSummaryContent,
  SurveyChart,
  Theme,
} from '../content/executive-summary';

export const SECTION_IDS = [
  'executiveSummary',
  'objectives',
  'kols',
  'overview',
  'keyTakeaways',
  'quotes',
  'conversationSummary',
  'hcpEngagement',
  'questionSummaries',
  'audienceInsights',
  'attendees',
  'surveyResults',
  'conclusions',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const SECTION_TITLES: Record<SectionId, string> = {
  executiveSummary: 'Executive Summary',
  objectives: 'Program Objectives',
  kols: 'Key Opinion Leaders',
  overview: 'Webinar Overview',
  keyTakeaways: 'Key Takeaways',
  quotes: 'Specific Comments',
  conversationSummary: 'Summary of Conversation',
  hcpEngagement: 'HCP Engagement: Questions & Themes',
  questionSummaries: 'Question Summaries',
  audienceInsights: 'HCP Audience Insights',
  attendees: 'Attendees',
  surveyResults: 'Post Webinar Survey Results',
  conclusions: 'Conclusion: Strategic Takeaways',
};

/** Audience Q&A sections; replaced by content.qaNote when none render. */
const QA_SECTIONS: readonly SectionId[] = ['hcpEngagement', 'questionSummaries', 'audienceInsights'];

export const TRANSCRIPT_KOLS_NOTE =
  'No KOLs are recorded in Content Hub for this program. Names and affiliations are as stated in the recording.';

export interface RenderOptions {
  htmlTemplate?: string;
  sections?: readonly SectionId[];
}

@Injectable()
export class ReportDocService {
  async renderExecutiveSummary(content: ExecutiveSummaryContent, options: RenderOptions = {}): Promise<string> {
    const enabled = new Set(options.sections ?? SECTION_IDS);
    const rendered: string[] = [];
    const omitted: SectionId[] = [];

    for (const id of SECTION_IDS) {
      if (!enabled.has(id)) continue;
      const body = renderSection(id, content);
      if (body) {
        rendered.push(`<section class="section section-${id}">\n<h2>${SECTION_TITLES[id]}</h2>\n${body}\n</section>`);
      } else {
        omitted.push(id);
      }
    }

    const enabledQa = QA_SECTIONS.filter((id) => enabled.has(id));
    const qaPending = Boolean(content.qaNote) && enabledQa.length > 0 && enabledQa.every((id) => omitted.includes(id));
    const missing = omitted.filter((id) => !(qaPending && QA_SECTIONS.includes(id))).map((id) => SECTION_TITLES[id]);

    const notes = [
      content.transcriptNote ?? null,
      content.inputCompletenessNote,
      qaPending ? (content.qaNote ?? null) : null,
      missing.length > 0 ? `Not included for lack of input data: ${missing.join(', ')}.` : null,
    ].filter((n): n is string => Boolean(n));

    const inputCompleteness = notes.length
      ? `<section class="input-completeness">\n<h2>Input Completeness</h2>\n${notes.map((n) => `<p>${esc(n)}</p>`).join('\n')}\n</section>`
      : '';

    return fill(options.htmlTemplate ?? BUILTIN_HTML_TEMPLATE, {
      title: esc(content.title),
      cover: renderCover(content),
      sections: rendered.join('\n'),
      inputCompleteness,
    });
  }
}

function renderCover(content: ExecutiveSummaryContent): string {
  const n = content.narrative;
  const kols = content.kols.map((k) => k.name).join(', ');
  const dates = [...new Set(content.sessions.map((s) => s.date).filter((d): d is string => Boolean(d)))]
    .map(formatDate)
    .join(' · ');
  const variant =
    n.format === 'pre_recorded_and_live'
      ? 'pre_record_and_webinar'
      : n.format === 'live_webinar'
        ? 'webinar_only'
        : n.format === 'pre_recorded'
          ? 'pre_record_only'
          : content.variant;
  const format =
    variant === 'pre_record_and_webinar'
      ? 'Pre-recorded conversation with live Q&A'
      : variant === 'webinar_only'
        ? 'Live webinar'
        : 'Pre-recorded conversation';
  return [
    '<header class="cover">',
    '<p class="eyebrow">Executive Summary</p>',
    `<h1>${esc(n.programTitle ?? content.campaignName)}</h1>`,
    n.programTitle && n.programTitle !== content.campaignName ? `<p class="subtitle">${esc(content.campaignName)}</p>` : '',
    '<dl class="cover-facts">',
    `<div><dt>Format</dt><dd>${esc(format)}</dd></div>`,
    kols ? `<div><dt>Key opinion leaders</dt><dd>${esc(kols)}</dd></div>` : '',
    dates ? `<div><dt>Date</dt><dd>${esc(dates)}</dd></div>` : '',
    '</dl>',
    '<p class="confidential">Confidential and for internal use only.</p>',
    '</header>',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderSection(id: SectionId, content: ExecutiveSummaryContent): string {
  const n = content.narrative;
  switch (id) {
    case 'executiveSummary':
      return claimList(n.executiveSummary);
    case 'objectives':
      return n.objectives.length ? `<ol class="objectives">${n.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ol>` : '';
    case 'kols':
      return content.kols.length
        ? [
            `<ul class="kols">${content.kols
              .map((k) => `<li><strong>${esc(k.name)}</strong>${k.affiliation ? `<span>${esc(k.affiliation)}</span>` : ''}</li>`)
              .join('')}</ul>`,
            content.kolSource === 'transcript' ? `<p class="note">${esc(TRANSCRIPT_KOLS_NOTE)}</p>` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : '';
    case 'overview':
      return paragraphs(n.overview);
    case 'keyTakeaways':
      return claimList(n.keyTakeaways);
    case 'quotes':
      return n.quotes.length
        ? n.quotes
            .map((q) => `<blockquote><p>“${esc(q.text)}”</p><cite>${esc(q.speaker)}</cite></blockquote>`)
            .join('\n')
        : '';
    case 'conversationSummary':
      return claimList(n.conversationSummary);
    case 'hcpEngagement':
      return themeList(n.hcpEngagementThemes, 'themes');
    case 'questionSummaries':
      return n.questionSummaries.length
        ? n.questionSummaries.map((t) => `<h3>${esc(t.theme)}</h3>\n<p>${esc(t.detail)}</p>`).join('\n')
        : '';
    case 'audienceInsights':
      return n.audienceInsights.length
        ? `<dl class="insights">${n.audienceInsights
            .map((i) => `<div><dt>${esc(i.label)}</dt><dd>${esc(i.body)}</dd></div>`)
            .join('')}</dl>`
        : '';
    case 'attendees':
      return content.attendees ? attendeesSection(content.attendees) : '';
    case 'surveyResults':
      return content.surveyCharts.map((c, i) => surveyChart(c, i + 1)).join('\n');
    case 'conclusions':
      return n.conclusions.length
        ? n.conclusions
            .map(
              (c) =>
                `<div class="claim"><h3>${esc(c.claim)}</h3><p>${esc(c.body)}</p>${
                  c.recommendation ? `<p class="recommendation"><strong>Strategic recommendation:</strong> ${esc(c.recommendation)}</p>` : ''
                }</div>`,
            )
            .join('\n')
        : '';
  }
}

function attendeesSection(a: AttendeesSummary): string {
  const rate = a.registered && a.attended !== null ? Math.round((a.attended / a.registered) * 100) : null;
  const facts = [
    a.registered !== null ? ['Registered', String(a.registered)] : null,
    a.attended !== null ? ['Attended', rate !== null ? `${a.attended} (${rate}% of registrants)` : String(a.attended)] : null,
    a.avgMinutesWatched !== null ? ['Average minutes watched', String(a.avgMinutesWatched)] : null,
  ].filter((f): f is string[] => f !== null);
  return [
    facts.length
      ? `<dl class="attendee-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
      : '',
    countTable('Attendees by specialty', 'Specialty', a.bySpecialty),
    countTable('Attendees by institution', 'Institution', a.byInstitution),
  ]
    .filter(Boolean)
    .join('\n');
}

function countTable(caption: string, heading: string, rows: CountRow[]): string {
  if (!rows.length) return '';
  return [
    `<table class="counts"><caption>${esc(caption)}</caption>`,
    `<thead><tr><th>${esc(heading)}</th><th>Attendees</th></tr></thead>`,
    `<tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.count}</td></tr>`).join('')}</tbody>`,
    '</table>',
  ].join('');
}

function claimList(items: Claim[]): string {
  return items.map((c) => `<div class="claim"><h3>${esc(c.claim)}</h3><p>${esc(c.body)}</p></div>`).join('\n');
}

function themeList(items: Theme[], cls: string): string {
  return items.length
    ? `<ul class="${cls}">${items.map((t) => `<li><strong>${esc(t.theme)}:</strong> ${esc(t.detail)}</li>`).join('')}</ul>`
    : '';
}

function paragraphs(items: string[]): string {
  return items.map((p) => `<p>${esc(p)}</p>`).join('\n');
}

/** Horizontal bar chart as inline SVG; percentages of respondents to that question. */
export function surveyChart(chart: SurveyChart, number: number): string {
  const rowH = 30;
  const labelW = 260;
  const barW = 320;
  const height = chart.options.length * rowH + 8;
  const rows = chart.options
    .map((o, i) => {
      const pct = chart.responses ? Math.round((o.count / chart.responses) * 100) : 0;
      const y = i * rowH + 4;
      const w = Math.max(2, Math.round((pct / 100) * barW));
      return [
        `<text x="0" y="${y + 18}" class="opt">${esc(truncate(o.label, 40))}</text>`,
        `<rect x="${labelW}" y="${y + 4}" width="${w}" height="${rowH - 10}" rx="3" class="bar"/>`,
        `<text x="${labelW + w + 8}" y="${y + 18}" class="pct">${pct}% (${o.count})</text>`,
      ].join('');
    })
    .join('');
  return [
    '<figure class="survey-chart">',
    `<figcaption><strong>${number}. ${esc(chart.question)}</strong> <span>${chart.responses} responses${
      chart.multiSelect ? ', multiple answers allowed' : ''
    }</span></figcaption>`,
    `<svg role="img" aria-label="${esc(chart.question)}" viewBox="0 0 ${labelW + barW + 90} ${height}" width="100%">${rows}</svg>`,
    '</figure>',
  ].join('\n');
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
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

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
