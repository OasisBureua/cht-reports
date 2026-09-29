import { redactAnswers, redactText, reportSurveyResponses } from './survey';
import type { ReportPacketSurvey } from '../packet/report-packet.types';

function survey(surveyType: string | null, answers: Record<string, unknown>): ReportPacketSurvey {
  return { respondentId: 'u1', source: 'native', surveyType, submittedAt: null, answers };
}

describe('reportSurveyResponses', () => {
  it('keeps FEEDBACK only (any case) and drops INTAKE, tests and untyped rows', () => {
    const out = reportSurveyResponses([
      survey('FEEDBACK', { q1_role: 'Oncologist' }),
      survey('feedback', { q1_role: 'NP' }),
      survey('INTAKE', { q1_phone: '555-123-4567' }),
      survey('PRE_TEST', { q1: 'a' }),
      survey('POST_TEST', { q1: 'b' }),
      survey(null, { q1: 'c' }),
    ]);
    expect(out).toEqual([{ q1_role: 'Oncologist' }, { q1_role: 'NP' }]);
  });

  it('drops contact-detail fields from FEEDBACK answers', () => {
    const [out] = reportSurveyResponses([
      survey('FEEDBACK', { q0_npi: '1234567890', q1_role: 'MD', contact: { email: 'a@b.co', city: 'Austin' } }),
    ]);
    expect(out).toEqual({ q1_role: 'MD', contact: {} });
  });

  it('matches whole words in keys, including camelCase', () => {
    const [out] = reportSurveyResponses([
      survey('FEEDBACK', { phoneNumber: 'x', q3_capacity: 'high', q4_handling: 'ok', q5ZipCode: '78701' }),
    ]);
    expect(out).toEqual({ q3_capacity: 'high', q4_handling: 'ok' });
  });
});

describe('redactText', () => {
  it('redacts emails, phone numbers and 10-digit ids in free text', () => {
    expect(redactText('Reach me at dr.x@clinic.org or (512) 555-0199, NPI 1234567890.')).toBe(
      'Reach me at [email] or [phone], NPI [id].',
    );
  });

  it('leaves ordinary answers alone', () => {
    expect(redactText('Moderately familiar, 10-20 patients per month')).toBe(
      'Moderately familiar, 10-20 patients per month',
    );
  });
});

describe('redactAnswers', () => {
  it('walks arrays and nested objects', () => {
    expect(redactAnswers({ factors: ['cost', 'call 512-555-0199'], n: 3 })).toEqual({
      factors: ['cost', 'call [phone]'],
      n: 3,
    });
  });
});
