/**
 * CPR-18 section 13, "Post Webinar Survey Results": one chart per closed
 * question with response count and count per option.
 *
 * With the survey's question schema (CPR-43), a choice question is labelled
 * with its prompt and lists every option in survey order, answered or not.
 * Answers with no schema entry fall back to a label from the answer key and
 * options ordered by count. Free-text questions are skipped here; the model
 * reads them as context instead.
 */

import type { ReportPacketSurveyQuestion } from '../packet/report-packet.types';
import type { SurveyChart } from './executive-summary';

const CHOICE_TYPES = new Set(['single_choice', 'multi_choice']);

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

function asOption(value: unknown, maxLength = MAX_OPTION_LENGTH): string | null {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v && v.length <= maxLength ? v : null;
}

export function buildSurveyCharts(
  answerSets: Record<string, unknown>[],
  questions: ReportPacketSurveyQuestion[] = [],
): SurveyChart[] {
  const schema = new Map<string, ReportPacketSurveyQuestion>();
  for (const q of questions) if (!schema.has(q.id)) schema.set(q.id, q);
  const position = new Map([...schema.keys()].map((id, i) => [id, i]));

  const byKey = new Map<string, { responses: number; multi: boolean; counts: Map<string, number>; freeText: boolean }>();

  for (const answers of answerSets) {
    for (const [key, value] of Object.entries(answers)) {
      const entry = byKey.get(key) ?? { responses: 0, multi: false, counts: new Map(), freeText: false };
      const values = Array.isArray(value) ? value : [value];
      if (Array.isArray(value)) entry.multi = true;
      // Schema options can be long sentences; the length cap only guards unknown keys.
      const maxLength = schema.has(key) ? Number.POSITIVE_INFINITY : MAX_OPTION_LENGTH;
      const options = values.map((v) => asOption(v, maxLength));
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
    .filter(([key, e]) => {
      const q = schema.get(key);
      if (q) return CHOICE_TYPES.has(q.type) && e.responses > 0;
      return !e.freeText && e.responses > 0 && e.counts.size <= MAX_OPTIONS;
    })
    .sort(
      ([a], [b]) =>
        (position.get(a) ?? Number.MAX_SAFE_INTEGER) - (position.get(b) ?? Number.MAX_SAFE_INTEGER) ||
        questionOrder(a) - questionOrder(b) ||
        a.localeCompare(b),
    )
    .map(([key, e]) => {
      const q = schema.get(key);
      const byCount = [...e.counts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((x, y) => y.count - x.count || x.label.localeCompare(y.label));
      if (!q) {
        return { question: questionLabel(key), responses: e.responses, multiSelect: e.multi, options: byCount };
      }
      const ordered = (q.options ?? []).map((label) => ({ label, count: e.counts.get(label) ?? 0 }));
      const listed = new Set(ordered.map((o) => o.label));
      return {
        question: q.prompt.trim() || questionLabel(key),
        responses: e.responses,
        multiSelect: q.type === 'multi_choice' || e.multi,
        // Answers outside the schema (an edited survey) go last, by count.
        options: [...ordered, ...byCount.filter((o) => !listed.has(o.label))],
      };
    });
}
