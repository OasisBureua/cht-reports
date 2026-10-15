/**
 * Survey responses as they may reach the model.
 *
 * v1 Executive Summary uses post-event FEEDBACK only: the report's survey
 * section is "Post Webinar Survey Results" (CPR-18 §13). INTAKE is
 * registration contact data, and PRE_TEST / POST_TEST have no answer key
 * or scoring on the platform yet, so neither belongs in the prompt.
 *
 * Contact details never go to the model. The FEEDBACK template itself asks
 * for NPI, and free text can carry emails or phone numbers.
 */

import type { ReportPacketSurvey } from '../packet/report-packet.types';

export const REPORT_SURVEY_TYPES = new Set(['FEEDBACK']);

// Whole words only, after splitting camelCase: `phoneNumber` and `q2_npi`
// match, `capacity` does not.
const CONTACT_WORD = /(^|[^a-z])(npi|phone|mobile|email|e_mail|address|street|city|zip|zipcode|postal|linkedin|twitter|website)([^a-z]|$)/;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const TEN_DIGITS = /\b\d{10}\b/g;

function isContactKey(key: string): boolean {
  return CONTACT_WORD.test(key.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase());
}

export function redactText(text: string): string {
  // Bare 10-digit ids (NPI) first, so the phone pattern doesn't claim them.
  return text.replace(EMAIL, '[email]').replace(TEN_DIGITS, '[id]').replace(PHONE, '[phone]');
}

export function redactAnswers(value: unknown): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactAnswers);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (isContactKey(key)) continue;
      out[key] = redactAnswers(v);
    }
    return out;
  }
  return value;
}

export function reportSurveyResponses(responses: ReportPacketSurvey[]): Record<string, unknown>[] {
  return responses
    .filter((r) => REPORT_SURVEY_TYPES.has((r.surveyType ?? '').toUpperCase()))
    .map((r) => redactAnswers(r.answers) as Record<string, unknown>);
}
