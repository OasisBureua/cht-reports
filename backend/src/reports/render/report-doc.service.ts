/**
 * Renders an Executive Summary to HTML as a 16:9 slide deck, in the order of
 * CHM's delivered Executive Summary reports (AstraZeneca DB-09: cover,
 * executive summary, overview and disclosures, KOLs, attendees, objectives,
 * program overview, conversation, takeaways, comments, survey results,
 * survey takeaways, strategic takeaways, next steps, closing). The audience
 * Q&A sections (from the Daiichi Sankyo report, CPR-18) follow the comments.
 *
 * The template (CPR-25, or the built-in one) owns page size and styling
 * through the placeholders {{title}}, {{cover}}, {{sections}}, {{closing}},
 * {{reportDate}} and {{inputCompleteness}}. This service owns slide markup
 * and pagination: long sections continue on further slides. Sections with
 * nothing to show are left out and named in the internal notes, which the
 * HTML preview shows and the printed PDF hides. `sections` limits which
 * sections render (CPR-18: toggleable without a new template version).
 */

import { Injectable } from '@nestjs/common';
import { BUILTIN_HTML_TEMPLATE } from '../templates/builtin';
import { withNarrativeDefaults } from '../content/executive-summary';
import type {
  AttendeeRow,
  AttendeesSummary,
  Claim,
  CountRow,
  ExecutiveSummaryContent,
  Point,
  SurveyChart,
} from '../content/executive-summary';

export const SECTION_IDS = [
  'executiveSummary',
  'disclosures',
  'kols',
  'attendees',
  'objectives',
  'overview',
  'conversationSummary',
  'keyTakeaways',
  'quotes',
  'hcpEngagement',
  'questionSummaries',
  'audienceInsights',
  'surveyResults',
  'surveyComments',
  'surveyTakeaways',
  'conclusions',
  'nextSteps',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Section names for the internal notes. Slide titles can differ (e.g. "Webinar objectives"). */
const SECTION_TITLES: Record<SectionId, string> = {
  executiveSummary: 'Executive Report Summary',
  disclosures: 'Overview and disclosures',
  kols: 'Key Opinion Leaders',
  attendees: 'Attendees',
  objectives: 'Objectives',
  overview: 'Overview',
  conversationSummary: 'Summary of Conversation',
  keyTakeaways: 'Key Takeaways',
  quotes: 'Specific Comments',
  hcpEngagement: 'HCP Engagement: Questions & Themes',
  questionSummaries: 'Question Summaries',
  audienceInsights: 'HCP Audience Insights',
  surveyResults: 'Post Webinar Survey Results',
  surveyComments: 'Survey Comments',
  surveyTakeaways: 'Survey Result Takeaways',
  conclusions: 'Strategic Takeaways',
  nextSteps: 'Conclusion & Actionable Next Steps',
};

/** Audience Q&A sections; replaced by content.qaNote when none render. */
const QA_SECTIONS: readonly SectionId[] = ['hcpEngagement', 'questionSummaries', 'audienceInsights'];

export const TRANSCRIPT_KOLS_NOTE =
  'No KOLs are recorded in Content Hub for this program. Names and affiliations are as stated in the recording.';

/** CHM's standard disclosures, as on its delivered Executive Summary reports. */
export function disclosures(program: string, event: string): string[] {
  return [
    `This ${program} was organized by Community Health Media, part of Community Health Technologies, Inc.`,
    'Content is developed exclusively by the KOLs in attendance.',
    `Everyone participating in this ${event} is required to disclose industry relationships.`,
    "The opinions discussed are those of the KOLs and HCPs and not always those of CHM.",
    'Any relationship with pharmaceutical companies involves acquiring an analytical report summarizing the insights with no identifiable individual data.',
    `Pharmaceutical companies had the option to participate in this ${event} as silent observers.`,
  ];
}

export interface RenderOptions {
  htmlTemplate?: string;
  sections?: readonly SectionId[];
}

/** Words that change with the program's format. */
interface Wording {
  /** "Webinar" or "Program", for slide titles. */
  program: string;
  /** "live event" or "program", for the disclosures. */
  event: string;
}

@Injectable()
export class ReportDocService {
  async renderExecutiveSummary(input: ExecutiveSummaryContent, options: RenderOptions = {}): Promise<string> {
    const content = { ...input, narrative: withNarrativeDefaults(input.narrative) };
    const enabled = new Set(options.sections ?? SECTION_IDS);
    const words = wording(content);
    const rendered: string[] = [];
    const omitted: SectionId[] = [];

    for (const id of SECTION_IDS) {
      if (!enabled.has(id)) continue;
      const slides = renderSection(id, content, words);
      if (slides.length) {
        rendered.push(...slides);
      } else {
        omitted.push(id);
      }
    }

    const enabledQa = QA_SECTIONS.filter((id) => enabled.has(id));
    const qaPending = Boolean(content.qaNote) && enabledQa.length > 0 && enabledQa.every((id) => omitted.includes(id));
    const missing = omitted.filter((id) => !(qaPending && QA_SECTIONS.includes(id))).map((id) => SECTION_TITLES[id]);

    const notes = [
      content.transcriptNote ?? null,
      content.kols.length && content.kolSource === 'transcript' ? TRANSCRIPT_KOLS_NOTE : null,
      content.inputCompletenessNote,
      qaPending ? (content.qaNote ?? null) : null,
      missing.length > 0 ? `Not included for lack of input data: ${missing.join(', ')}.` : null,
    ].filter((n): n is string => Boolean(n));

    const inputCompleteness = notes.length
      ? [
          '<section class="internal-notes">',
          '<h2>Input Completeness</h2>',
          '<p class="internal-label">Internal: shown in the HTML preview, left out of the PDF.</p>',
          notes.map((n) => `<p>${esc(n)}</p>`).join('\n'),
          '</section>',
        ].join('\n')
      : '';

    return fill(options.htmlTemplate ?? BUILTIN_HTML_TEMPLATE, {
      title: esc(content.title),
      cover: renderCover(content, words),
      sections: rendered.join('\n'),
      closing: renderClosing(content),
      reportDate: esc(reportMonth(content)),
      inputCompleteness,
    });
  }
}

function wording(content: ExecutiveSummaryContent): Wording {
  return content.variant === 'pre_record_only'
    ? { program: 'Program', event: 'program' }
    : { program: 'Webinar', event: 'live event' };
}

// ---------------------------------------------------------------- slides

interface SlideOptions {
  /** Small line above the title (e.g. the program title). */
  kicker?: string | null;
  /** Dark brand background. */
  dark?: boolean;
  /** Extra classes. */
  className?: string;
}

function slide(id: SectionId | 'cover' | 'divider' | 'closing', title: string | null, body: string, opts: SlideOptions = {}): string {
  const classes = ['slide', `section-${id}`, opts.dark ? 'slide-dark' : '', opts.className ?? ''].filter(Boolean).join(' ');
  return [
    `<section class="${classes}">`,
    title
      ? `<header class="slide-head">${opts.kicker ? `<p class="kicker">${esc(opts.kicker)}</p>` : ''}<h2>${esc(title)}</h2></header>`
      : '',
    `<div class="slide-body">${body}</div>`,
    '<div class="brand-logo" aria-hidden="true"></div>',
    '</section>',
  ].join('');
}

function divider(title: string, subtitle: string | null = null): string {
  return [
    '<section class="slide section-divider slide-dark">',
    '<div class="divider-mark" aria-hidden="true"></div>',
    `<div class="divider-text"><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>`,
    '<div class="brand-logo" aria-hidden="true"></div>',
    '</section>',
  ].join('');
}

/** "Title", then "Title (cont.)" on the slides that continue it. */
function titled(title: string, index: number): string {
  return index === 0 ? title : `${title} (cont.)`;
}

/**
 * Split items into slides: at most `maxItems` per slide and roughly
 * `capacity` characters of text, so a slide never overflows.
 */
export function paginate<T>(items: T[], size: (item: T) => number, capacity: number, maxItems: number): T[][] {
  const pages = fillPages(items, size, capacity, maxItems);
  // Balance: the tightest capacity that still needs no more slides, so a
  // continuation slide isn't left nearly empty.
  let best = pages;
  for (let cap = capacity * 0.95; cap >= capacity * 0.5; cap -= capacity * 0.05) {
    const tighter = fillPages(items, size, cap, maxItems);
    if (tighter.length > pages.length) break;
    best = tighter;
  }
  return best;
}

function fillPages<T>(items: T[], size: (item: T) => number, capacity: number, maxItems: number): T[][] {
  const pages: T[][] = [];
  let page: T[] = [];
  let used = 0;
  for (const item of items) {
    const s = size(item);
    if (page.length && (page.length >= maxItems || used + s > capacity)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(item);
    used += s;
  }
  if (page.length) pages.push(page);
  return pages;
}

/**
 * Rough rendered height (px) of text at a font size in a column width,
 * for pagination. Chillax averages about 0.46em per character (measured with scripts/local/check-layout.js).
 */
export function textHeight(text: string, fontPx: number, lineHeight: number, widthPx: number): number {
  if (!text) return 0;
  const perLine = Math.max(1, Math.floor(widthPx / (fontPx * 0.46)));
  return Math.ceil(text.length / perLine) * fontPx * lineHeight;
}

/** Body height available on a slide under its title (px). */
const BODY = 500;
/** Width of a full-width list item, and of one of two columns (px). */
const FULL = 1040;
const HALF = 500;

const arrowSize = (c: Claim) => textHeight(c.claim, 25, 1.25, FULL - 66) + (c.body ? 6 + textHeight(c.body, 18, 1.45, FULL - 66) : 0) + 24;
const pointSize = (title: string, detail: string | null) =>
  textHeight(title, 23, 1.3, FULL - 30) + (detail ? 4 + textHeight(detail, 18, 1.45, FULL - 30) : 0) + 20;
/** Two-column claims: both columns' height together. */
const claimSize = (c: Claim) => textHeight(c.claim, 22, 1.25, HALF - 22) + 6 + textHeight(c.body, 18, 1.45, HALF - 22) + 22;

function renderSection(id: SectionId, content: ExecutiveSummaryContent, words: Wording): string[] {
  const n = content.narrative;
  switch (id) {
    case 'executiveSummary':
      return paginate(n.executiveSummary, arrowSize, BODY, 5).map((page, i) =>
        slide(id, titled('Executive Report Summary', i), arrowList(page)),
      );

    case 'disclosures':
      return [
        slide(
          id,
          `${words.program} Overview`,
          `<ul class="disclosures">${disclosures(words.event === 'program' ? 'program' : 'webinar', words.event)
            .map((d) => `<li>${esc(d)}</li>`)
            .join('')}</ul>`,
          { className: 'slide-accent' },
        ),
      ];

    case 'kols':
      return paginate(content.kols, () => 1, 4, 4).map((page, i) =>
        slide(
          id,
          titled('Key Opinion Leaders', i),
          `<ul class="kol-cards kol-count-${page.length}">${page
            .map(
              (k) =>
                `<li><div class="kol-avatar">${esc(initials(k.name))}</div><div class="kol-band"><strong>${esc(k.name)}</strong>${
                  k.affiliation ? `<span>${esc(k.affiliation)}</span>` : ''
                }</div></li>`,
            )
            .join('')}</ul>`,
        ),
      );

    case 'attendees':
      return content.attendees ? attendeeSlides(content.attendees, words) : [];

    case 'objectives': {
      const items = n.objectives.map(asPoint);
      return paginate(items, (p) => pointSize(p.title, p.detail), BODY, 6).map((page, i) =>
        slide(
          id,
          titled(`${words.program} Objectives`, i),
          `<ul class="points">${page
            .map((p) => `<li><strong>${esc(p.title)}</strong>${p.detail ? `<p>${esc(p.detail)}</p>` : ''}</li>`)
            .join('')}</ul>`,
        ),
      );
    }

    case 'overview':
      return n.overview.length ? [overviewSlide(content, words)] : [];

    case 'conversationSummary': {
      const slides = paginate(n.conversationSummary, claimSize, BODY * 2 - 40, 6).map((page, i) =>
        slide(id, titled('Summary of Conversation', i), claimColumns(page)),
      );
      return slides.length ? [divider(conversationTitle(content)), ...slides] : [];
    }

    case 'keyTakeaways':
      return paginate(n.keyTakeaways, claimSize, BODY * 2 - 40, 6).map((page, i) =>
        slide(id, i === 0 ? 'Key Takeaways' : 'More Key Takeaways', claimColumns(page)),
      );

    case 'quotes':
      return paginate(n.quotes, (q) => textHeight(q.text, 21, 1.4, HALF - 58) + 54, BODY * 2 - 40, 6).map((page, i) =>
        slide(
          id,
          titled('Specific Comments', i),
          `<div class="quotes">${page
            .map(
              (q) =>
                `<blockquote><p>${esc(q.text)}</p><cite>${esc(q.source === 'attendee' ? 'Attendee' : q.speaker)}</cite></blockquote>`,
            )
            .join('')}</div>`,
          { dark: true },
        ),
      );

    case 'hcpEngagement':
      return paginate(n.hcpEngagementThemes, (t) => pointSize(t.theme, t.detail), BODY, 6).map((page, i) =>
        slide(
          id,
          titled('HCP Engagement: Questions & Themes', i),
          `<ul class="points">${page.map((t) => `<li><strong>${esc(t.theme)}</strong><p>${esc(t.detail)}</p></li>`).join('')}</ul>`,
        ),
      );

    case 'questionSummaries':
      return paginate(n.questionSummaries, (t) => claimSize({ claim: t.theme, body: t.detail }), BODY * 2 - 40, 6).map((page, i) =>
        slide(id, titled('Question Summaries', i), claimColumns(page.map((t) => ({ claim: t.theme, body: t.detail })))),
      );

    case 'audienceInsights':
      return paginate(n.audienceInsights, (a) => textHeight(a.body, 16, 1.45, 330) + 70, BODY * 3 - 60, 6).map((page, i) =>
        slide(
          id,
          titled('HCP Audience Insights', i),
          `<div class="tiles">${page
            .map((a) => `<div class="tile"><h3>${esc(a.label)}</h3><p>${esc(a.body)}</p></div>`)
            .join('')}</div>`,
        ),
      );

    case 'surveyResults':
      return content.surveyCharts.length
        ? [
            divider(`Post ${words.program} Survey Results`, responsesLabel(content)),
            ...content.surveyCharts.map((c) => chartSlide(c)),
          ]
        : [];

    case 'surveyComments':
      return (content.surveyFreeText ?? []).flatMap((q) =>
        paginate(q.answers, (a) => textHeight(a, 17, 1.45, 500) + 50, BODY * 2 - 60, 8).map((page) =>
          slide(
            id,
            q.question,
            `<div class="comment-grid">${page.map((a) => `<blockquote><p>“${esc(a)}”</p></blockquote>`).join('')}</div>`,
            { className: 'slide-survey' },
          ),
        ),
      );

    case 'surveyTakeaways':
      return paginate(
        n.surveyTakeaways,
        (t) => textHeight(t.theme, 17, 1.3, 470) + t.points.reduce((h, p) => h + textHeight(p, 16, 1.45, 450) + 4, 0) + 40,
        BODY * 2 - 60,
        4,
      ).map((page, i) =>
        slide(
          id,
          titled('Survey Result Takeaways', i),
          `<div class="takeaway-grid">${page
            .map(
              (t) =>
                `<div class="takeaway">${icon('chart')}<div><h3>${esc(t.theme)}</h3><ul>${t.points
                  .map((p) => `<li>${esc(p)}</li>`)
                  .join('')}</ul></div></div>`,
            )
            .join('')}</div>`,
        ),
      );

    case 'conclusions':
      return paginate(n.conclusions, (c) => pointSize(c.claim, `${c.body} ${c.recommendation ?? ''}`.trim()), BODY, 6).map((page, i) =>
        slide(
          id,
          titled('Strategic Takeaways', i),
          `<ul class="points">${page
            .map(
              (c) =>
                `<li><strong>${esc(c.claim)}</strong><p>${esc(c.body)}</p>${
                  c.recommendation ? `<p class="recommendation">Recommendation: ${esc(c.recommendation)}</p>` : ''
                }</li>`,
            )
            .join('')}</ul>`,
          { dark: true },
        ),
      );

    case 'nextSteps':
      return paginate(n.nextSteps, () => 1, 3, 3).map((page, i) =>
        slide(
          id,
          titled('Conclusion & Actionable Next Steps', i),
          `<div class="next-steps">${page
            .map((c, j) => `<div class="step step-${j + 1}">${icon('check')}<h3>${esc(c.claim)}</h3><p>${esc(c.body)}</p></div>`)
            .join('')}</div>`,
        ),
      );
  }
}

function arrowList(items: Claim[]): string {
  return `<ul class="arrows">${items
    .map((c) => `<li><strong>${esc(c.claim)}</strong>${c.body ? `<p>${esc(c.body)}</p>` : ''}</li>`)
    .join('')}</ul>`;
}

function claimColumns(items: Claim[]): string {
  return `<div class="claims">${items
    .map((c) => `<div class="claim"><h3>${esc(c.claim)}</h3><p>${esc(c.body)}</p></div>`)
    .join('')}</div>`;
}

function asPoint(o: string | Point): Point {
  return typeof o === 'string' ? { title: o, detail: null } : o;
}

function initials(name: string): string {
  const parts = name
    .replace(/^(dr|prof|professor)\.?\s+/i, '')
    .split(/\s+/)
    .filter((p) => /^[A-Za-z]/.test(p));
  return parts.length ? `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase() : '';
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function conversationTitle(content: ExecutiveSummaryContent): string {
  const names = content.kols.map((k) => k.name);
  return names.length >= 2 && names.length <= 3 ? `Conversation between ${joinNames(names)}` : 'The Conversation';
}

function responsesLabel(content: ExecutiveSummaryContent): string | null {
  const n = content.surveyResponseCount ?? Math.max(0, ...content.surveyCharts.map((c) => c.responses));
  return n ? `${n} ${n === 1 ? 'response' : 'responses'}` : null;
}

// ---------------------------------------------------------------- cover / closing

function formatLabel(content: ExecutiveSummaryContent): string {
  switch (content.variant) {
    case 'webinar_only':
      return content.hasQa ? 'Live webinar with real-time Q&A' : 'Live webinar';
    case 'pre_record_and_webinar':
      return 'Pre-recorded conversation & live webinar';
    default:
      return 'Pre-recorded conversation';
  }
}

function renderCover(content: ExecutiveSummaryContent, words: Wording): string {
  const n = content.narrative;
  const kols = joinNames(content.kols.map((k) => k.name));
  const when = [...new Set(content.sessions.map((s) => s.date).filter((d): d is string => Boolean(d)))]
    .map((d) => formatDateTime(d, content.variant !== 'pre_record_only'))
    .join(' · ');
  const surveyed = (content.surveyResponseCount ?? 0) > 0 || content.surveyCharts.length > 0;
  return [
    '<section class="slide slide-cover">',
    '<div class="cover-panel">',
    '<div class="brand-lockup" aria-hidden="true"></div>',
    `<p class="eyebrow">${esc(words.program)} Executive Summary Report</p>`,
    `<h1>${esc(n.programTitle ?? content.campaignName)}</h1>`,
    `<p class="cover-format">${esc(formatLabel(content))}</p>`,
    kols ? `<p class="cover-kols">${esc(kols)}</p>` : '',
    when ? `<p class="cover-date">${esc(content.variant === 'pre_record_only' ? when : `Live · ${when}`)}</p>` : '',
    '</div>',
    '<div class="cover-art" aria-hidden="true"></div>',
    '<div class="cover-meta">',
    n.programTitle && n.programTitle !== content.campaignName ? `<p>${esc(content.campaignName)}</p>` : '',
    surveyed ? '<p>Updated with survey insights</p>' : '',
    `<p>${esc(reportMonth(content))}</p>`,
    '<p class="confidential">Confidential and for internal use only.</p>',
    '</div>',
    '</section>',
  ]
    .filter(Boolean)
    .join('');
}

function renderClosing(content: ExecutiveSummaryContent): string {
  return [
    '<section class="slide section-closing slide-dark">',
    '<div class="divider-mark" aria-hidden="true"></div>',
    '<div class="closing-text">',
    '<h2>Thank you.</h2>',
    `<p>${esc(reportMonth(content))}</p>`,
    '<p>Community Health Technologies Inc. · communityhealth.media</p>',
    '</div>',
    '<div class="brand-logo" aria-hidden="true"></div>',
    '</section>',
  ].join('');
}

// ---------------------------------------------------------------- overview

function overviewSlide(content: ExecutiveSummaryContent, words: Wording): string {
  const n = content.narrative;
  const a = content.attendees;
  const people = [
    content.kols.length ? `${content.kols.length} key opinion ${content.kols.length === 1 ? 'leader' : 'leaders'}` : null,
    a?.attended ? `${a.attended} ${a.attended === 1 ? 'attendee' : 'attendees'}` : null,
  ].filter(Boolean);
  const tiles = [
    people.length ? ['people', people.join(' & ')] : null,
    ['presentation', formatLabel(content)],
    ...n.overviewHighlights.slice(0, 3).map((h) => ['chat', h]),
    content.surveyCharts.length ? ['chart', 'Full insight report + survey analytics included'] : null,
  ].filter((t): t is string[] => t !== null);
  return slide(
    'overview',
    'Overview',
    [
      `<div class="overview"><div class="overview-text">${n.overview.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`,
      `<ul class="overview-tiles">${tiles.map(([k, label]) => `<li>${icon(k)}<span>${esc(label)}</span></li>`).join('')}</ul></div>`,
    ].join(''),
    { kicker: `CHM ${words.program === 'Program' ? 'program' : 'conversation'} · ${n.programTitle ?? content.campaignName}` },
  );
}

// ---------------------------------------------------------------- attendees

/** Attendee rows per slide: fewer on the first, under the attendance figures. */
const ROWS_FIRST_SLIDE = 10;
const ROWS_PER_SLIDE = 13;
/** Beyond this many attendees the section shows counts instead of one row each. */
const MAX_ATTENDEE_ROWS = 60;

function attendeeSlides(a: AttendeesSummary, words: Wording): string[] {
  const rate = a.registered && a.attended !== null ? Math.round((a.attended / a.registered) * 100) : null;
  const facts = [
    a.registered !== null ? ['Registered', String(a.registered)] : null,
    a.attended !== null ? ['Attended', rate !== null ? `${a.attended} (${rate}%)` : String(a.attended)] : null,
    a.avgMinutesWatched !== null ? ['Average minutes watched', String(a.avgMinutesWatched)] : null,
  ].filter((f): f is string[] => f !== null);
  const factsHtml = facts.length
    ? `<dl class="attendee-facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
    : '';
  const rows = a.rows ?? [];
  const label = `Attendees – ${words.program === 'Program' ? 'Program' : 'Live Webinar'}`;

  if (rows.length === 0 || rows.length > MAX_ATTENDEE_ROWS) {
    const tables = [countTable('Specialty', a.bySpecialty), countTable('Institution', a.byInstitution)].filter(Boolean).join('');
    return factsHtml || tables ? [slide('attendees', label, `${factsHtml}<div class="count-tables">${tables}</div>`)] : [];
  }

  // Slides needed, then rows spread evenly so the last slide isn't a stub.
  const count = rows.length <= ROWS_FIRST_SLIDE ? 1 : 1 + Math.ceil((rows.length - ROWS_FIRST_SLIDE) / ROWS_PER_SLIDE);
  const per = Math.ceil(rows.length / count);
  const pages: AttendeeRow[][] = [];
  for (let i = 0; i < rows.length; i += per) pages.push(rows.slice(i, i + per));
  let start = 1;
  return pages.map((page, i) => {
    const range = `(${start}–${start + page.length - 1})`;
    start += page.length;
    const table = [
      '<table class="attendee-table"><thead><tr><th>Type of participant</th><th>Type of medicine</th><th>Practice name</th></tr></thead><tbody>',
      page.map((r) => `<tr><td>${icon('person')}</td><td>${esc(r.specialty)}</td><td>${esc(r.institution)}</td></tr>`).join(''),
      '</tbody></table>',
    ].join('');
    return slide('attendees', `${label} ${range}`, `${i === 0 ? factsHtml : ''}${table}`);
  });
}

function countTable(heading: string, rows: CountRow[]): string {
  if (!rows.length) return '';
  return [
    `<table class="attendee-table"><thead><tr><th>${esc(heading)}</th><th>Attendees</th></tr></thead>`,
    `<tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.count}</td></tr>`).join('')}</tbody>`,
    '</table>',
  ].join('');
}

// ---------------------------------------------------------------- survey charts

/** Brand chart palette (Brand Guidelines v1.4), then lighter tints. */
const CHART_COLORS = ['#3a839b', '#ff9e40', '#3da4c0', '#e7764f', '#79869a', '#485165', '#9fd2e0', '#ffcf9f', '#b8c0cc'];

function pct(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) : 0;
}

/** One survey question per slide: a pie for single-choice, bars for multi-select. */
export function chartSlide(chart: SurveyChart): string {
  const title = `${chart.question} (${chart.responses} ${chart.responses === 1 ? 'response' : 'responses'})`;
  if (chart.multiSelect) {
    return slide(
      'surveyResults',
      title,
      `<figure class="survey-chart multi">${barRows(chart)}<p class="chart-note">Multiple answers allowed: percentages are of respondents.</p></figure>`,
      { className: 'slide-survey' },
    );
  }
  const visual = pieChart(chart);
  const legend = `<ul class="legend">${chart.options
    .map(
      (o, i) =>
        `<li class="${o.count ? '' : 'zero'}"><span class="swatch" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></span><span class="opt">${esc(
          o.label,
        )}</span><span class="val">${o.count} · ${pct(o.count, chart.responses)}%</span></li>`,
    )
    .join('')}</ul>`;
  return slide(
    'surveyResults',
    title,
    `<figure class="survey-chart">${visual}<figcaption>${legend}</figcaption></figure>`,
    { className: 'slide-survey' },
  );
}

function pieChart(chart: SurveyChart): string {
  const total = chart.options.reduce((s, o) => s + o.count, 0);
  const r = 150;
  const c = 160;
  if (!total) return `<svg class="pie" viewBox="0 0 320 320" role="img" aria-label="${esc(chart.question)}"></svg>`;
  let angle = -Math.PI / 2;
  const parts: string[] = [];
  chart.options.forEach((o, i) => {
    if (!o.count) return;
    const color = CHART_COLORS[i % CHART_COLORS.length];
    const sweep = (o.count / total) * Math.PI * 2;
    if (o.count === total) {
      parts.push(`<circle cx="${c}" cy="${c}" r="${r}" fill="${color}"/>`);
    } else {
      const x1 = c + r * Math.cos(angle);
      const y1 = c + r * Math.sin(angle);
      const x2 = c + r * Math.cos(angle + sweep);
      const y2 = c + r * Math.sin(angle + sweep);
      parts.push(
        `<path d="M${c},${c} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z" fill="${color}"/>`,
      );
    }
    if (o.count / total >= 0.06) {
      const mid = angle + sweep / 2;
      const lx = o.count === total ? c : c + r * 0.62 * Math.cos(mid);
      const ly = o.count === total ? c : c + r * 0.62 * Math.sin(mid);
      parts.push(`<text x="${lx.toFixed(1)}" y="${(ly + 7).toFixed(1)}" class="slice-label">${o.count}</text>`);
    }
    angle += sweep;
  });
  return `<svg class="pie" viewBox="0 0 320 320" role="img" aria-label="${esc(chart.question)}">${parts.join('')}</svg>`;
}

/** Multi-select: one labelled bar per option, as a share of respondents. */
function barRows(chart: SurveyChart): string {
  return `<ul class="bar-rows">${chart.options
    .map((o, i) => {
      const p = pct(o.count, chart.responses);
      return `<li class="${o.count ? '' : 'zero'}"><span class="opt">${esc(o.label)}</span><span class="track"><span class="bar" style="width:${Math.max(
        1,
        p,
      )}%;background:${CHART_COLORS[i % CHART_COLORS.length]}"></span></span><span class="val">${o.count} · ${p}%</span></li>`;
    })
    .join('')}</ul>`;
}

/** Kept for callers of the 1.2.0 renderer: a single chart as a figure. */
export function surveyChart(chart: SurveyChart, number: number): string {
  return chartSlide({ ...chart, question: `${number}. ${chart.question}` });
}

// ---------------------------------------------------------------- icons

/** Outline icons (Brand Guidelines v1.4: always-outline style). */
function icon(name: string): string {
  const paths: Record<string, string> = {
    people:
      '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6"/><path d="M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2.8 0 5 2 5 5"/>',
    presentation: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8"/><path d="M7 12l3-3 2 2 4-4"/>',
    chat: '<path d="M4 5h16v10H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7" y="11" width="3" height="6"/><rect x="12" y="7" width="3" height="10"/><rect x="17" y="13" width="3" height="4"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5"/>',
  };
  return `<svg class="icon icon-${name}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ''}</svg>`;
}

// ---------------------------------------------------------------- formatting

function reportMonth(content: ExecutiveSummaryContent): string {
  const d = new Date(content.generatedAt ?? Date.now());
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'America/New_York' });
}

function formatDateTime(iso: string, withTime: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  if (!withTime || !/T\d{2}:\d{2}/.test(iso)) return date;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' });
  return `${date} at ${time}`;
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
