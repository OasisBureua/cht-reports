/**
 * Executive Summary content model (CPR-18) and the parser for the model's
 * JSON output.
 *
 * The model writes the narrative sections; everything factual that the
 * packet already holds (sessions, dates, survey counts, input
 * completeness) is filled in by code, never by the model.
 */

export interface Claim {
  /** Bolded lead sentence. */
  claim: string;
  /** Supporting paragraph. */
  body: string;
}

export interface Kol {
  name: string;
  /** Title and institution as stated in the recording. */
  affiliation: string | null;
}

export interface Quote {
  text: string;
  speaker: string;
}

export interface Theme {
  theme: string;
  detail: string;
}

export interface Insight {
  /** e.g. "Highest curiosity", "Greatest uncertainty". */
  label: string;
  body: string;
}

export interface Conclusion {
  claim: string;
  body: string;
  recommendation: string | null;
}

/** What the model returns. Every list may be empty when the input can't support it. */
export interface GeneratedNarrative {
  programTitle: string | null;
  executiveSummary: Claim[];
  objectives: string[];
  kols: Kol[];
  overview: string[];
  keyTakeaways: Claim[];
  quotes: Quote[];
  conversationSummary: Claim[];
  hcpEngagementThemes: Theme[];
  questionSummaries: Theme[];
  audienceInsights: Insight[];
  conclusions: Conclusion[];
}

export interface SurveyChartOption {
  label: string;
  count: number;
}

export interface SurveyChart {
  question: string;
  responses: number;
  /** Multi-select questions: counts can exceed responses. */
  multiSelect: boolean;
  options: SurveyChartOption[];
}

export interface SessionSummary {
  title: string | null;
  kind: string | null;
  date: string | null;
}

export type ReportVariant = 'pre_record_and_webinar' | 'webinar_only' | 'pre_record_only';

export interface ExecutiveSummaryContent {
  title: string;
  campaignName: string;
  variant: ReportVariant;
  sessions: SessionSummary[];
  narrative: GeneratedNarrative;
  surveyCharts: SurveyChart[];
  /** Registration/attendance data; not in the packet yet. */
  attendees: null;
  inputCompletenessNote: string | null;
}

export class NarrativeParseError extends Error {}

const EMPTY: GeneratedNarrative = {
  programTitle: null,
  executiveSummary: [],
  objectives: [],
  kols: [],
  overview: [],
  keyTakeaways: [],
  quotes: [],
  conversationSummary: [],
  hcpEngagementThemes: [],
  questionSummaries: [],
  audienceInsights: [],
  conclusions: [],
};

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function list<T>(value: unknown, pick: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? pick(item as Record<string, unknown>) : null))
    .filter((item): item is T => item !== null);
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(str).filter((s): s is string => s !== null) : [];
}

function claims(value: unknown): Claim[] {
  return list(value, (o) => {
    const claim = str(o.claim);
    const body = str(o.body);
    return claim && body ? { claim, body } : null;
  });
}

function themes(value: unknown): Theme[] {
  return list(value, (o) => {
    const theme = str(o.theme);
    const detail = str(o.detail);
    return theme && detail ? { theme, detail } : null;
  });
}

/**
 * Pull the JSON object out of the model's reply (tolerates a ```json fence
 * or stray prose around it) and normalize it to GeneratedNarrative.
 * Malformed items are dropped rather than failing the report; a reply with
 * no parseable object at all throws.
 */
export function parseNarrative(text: string): GeneratedNarrative {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new NarrativeParseError('model reply contains no JSON object');
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch (err) {
    throw new NarrativeParseError(`model reply is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }

  return {
    ...EMPTY,
    programTitle: str(raw.programTitle),
    executiveSummary: claims(raw.executiveSummary),
    objectives: strings(raw.objectives),
    kols: list(raw.kols, (o) => {
      const name = str(o.name);
      return name ? { name, affiliation: str(o.affiliation) } : null;
    }),
    overview: strings(raw.overview),
    keyTakeaways: claims(raw.keyTakeaways),
    quotes: list(raw.quotes, (o) => {
      const text = str(o.text);
      const speaker = str(o.speaker);
      return text && speaker ? { text, speaker } : null;
    }),
    conversationSummary: claims(raw.conversationSummary),
    hcpEngagementThemes: themes(raw.hcpEngagementThemes),
    questionSummaries: themes(raw.questionSummaries),
    audienceInsights: list(raw.audienceInsights, (o) => {
      const label = str(o.label);
      const body = str(o.body);
      return label && body ? { label, body } : null;
    }),
    conclusions: list(raw.conclusions, (o) => {
      const claim = str(o.claim);
      const body = str(o.body);
      return claim && body ? { claim, body, recommendation: str(o.recommendation) } : null;
    }),
  };
}
