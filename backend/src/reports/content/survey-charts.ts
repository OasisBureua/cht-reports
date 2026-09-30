/**
 * CPR-18 section 13, "Post Webinar Survey Results": one chart per closed
 * question with response count and count per option.
 *
 * Built from the answers alone. The packet does not carry the survey's
 * question schema yet (prompts, option order), so questions are labelled
 * from their answer keys and options are ordered by count. Free-text
 * questions are skipped here; the model reads them as context instead.
 */

import type { SurveyChart } from './executive-summary';

/** A question with more distinct answers than this is treated as free text. */
const MAX_OPTIONS = 12;
/** Answers longer than this are free text, not an option. */
const MAX_OPTION_LENGTH = 80;

export function questionLabel(key: string): string {
  const words = key
    .replace(/^q\d+[_-]?/i, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

function questionOrder(key: string): number {
  const m = /^q(\d+)/i.exec(key);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function asOption(value: unknown): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v && v.length <= MAX_OPTION_LENGTH ? v : null;
}

export function buildSurveyCharts(answerSets: Record<string, unknown>[]): SurveyChart[] {
  const byKey = new Map<string, { responses: number; multi: boolean; counts: Map<string, number>; freeText: boolean }>();

  for (const answers of answerSets) {
    for (const [key, value] of Object.entries(answers)) {
      const entry = byKey.get(key) ?? { responses: 0, multi: false, counts: new Map(), freeText: false };
      const values = Array.isArray(value) ? value : [value];
      if (Array.isArray(value)) entry.multi = true;
      const options = values.map(asOption);
      if (options.some((o) => o === null) && values.some((v) => typeof v === 'string' && v.trim())) {
        entry.freeText = true;
      }
      const kept = options.filter((o): o is string => o !== null);
      if (kept.length > 0) entry.responses += 1;
      for (const option of kept) entry.counts.set(option, (entry.counts.get(option) ?? 0) + 1);
      byKey.set(key, entry);
    }
  }

  return [...byKey.entries()]
    .filter(([, e]) => !e.freeText && e.responses > 0 && e.counts.size <= MAX_OPTIONS)
    .sort(([a], [b]) => questionOrder(a) - questionOrder(b) || a.localeCompare(b))
    .map(([key, e]) => ({
      question: questionLabel(key),
      responses: e.responses,
      multiSelect: e.multi,
      options: [...e.counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label)),
    }));
}
