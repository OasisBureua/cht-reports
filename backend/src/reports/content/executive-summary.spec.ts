import { NarrativeParseError, parseNarrative } from './executive-summary';
import { buildSurveyCharts, questionLabel } from './survey-charts';
import { estimateCostUsd, fitToLimit } from '../orchestrator';

describe('parseNarrative', () => {
  it('reads a fenced JSON reply and fills missing keys with empty lists', () => {
    const n = parseNarrative('Here you go:\n```json\n{"programTitle":"T","objectives":["Review X"],"kols":[{"name":"Dr. A","affiliation":null}]}\n```');
    expect(n.programTitle).toBe('T');
    expect(n.objectives).toEqual(['Review X']);
    expect(n.kols).toEqual([{ name: 'Dr. A', affiliation: null }]);
    expect(n.keyTakeaways).toEqual([]);
    expect(n.format).toBeNull();
    expect(n.conclusions).toEqual([]);
  });

  it('accepts only known formats', () => {
    expect(parseNarrative('{"format":"live_webinar"}').format).toBe('live_webinar');
    expect(parseNarrative('{"format":"podcast"}').format).toBeNull();
  });

  it('drops malformed items instead of failing', () => {
    const n = parseNarrative(
      JSON.stringify({
        executiveSummary: [{ claim: 'A', body: 'B' }, { claim: 'no body' }, 'str', null],
        quotes: [{ text: 'q', speaker: '' }, { text: 'ok', speaker: 'Dr. Y' }],
        conclusions: [{ claim: 'C', body: 'D' }],
      }),
    );
    expect(n.executiveSummary).toEqual([{ claim: 'A', body: 'B' }]);
    expect(n.quotes).toEqual([{ text: 'ok', speaker: 'Dr. Y' }]);
    expect(n.conclusions).toEqual([{ claim: 'C', body: 'D', recommendation: null }]);
  });

  it('repairs unescaped quotes inside strings and a reply cut off mid-list', () => {
    const n = parseNarrative('{"quotes":[{"text":"It was "amazing" to see","speaker":"Dr. Yan"}],"objectives":["Review A","Review');
    expect(n.quotes).toEqual([{ text: 'It was "amazing" to see', speaker: 'Dr. Yan' }]);
    expect(n.objectives[0]).toBe('Review A');
  });

  it('throws when there is no JSON object', () => {
    expect(() => parseNarrative('# Executive Summary\nplain markdown')).toThrow(NarrativeParseError);
  });
});

describe('buildSurveyCharts', () => {
  it('counts single and multi-select answers, skips free text, orders by question number', () => {
    const charts = buildSurveyCharts([
      { q2_setting: 'Community', q10_factors: ['Cost', 'Efficacy'], q3_change: 'I will re-test HER2-0 patients more often going forward in clinic, especially after progression on endocrine therapy.' },
      { q2_setting: 'Academic', q10_factors: ['Cost'] },
      { q2_setting: 'Community' },
    ]);
    expect(charts.map((c) => c.question)).toEqual(['Setting', 'Factors']);
    expect(charts[0]).toEqual({
      question: 'Setting',
      responses: 3,
      multiSelect: false,
      options: [
        { label: 'Community', count: 2 },
        { label: 'Academic', count: 1 },
      ],
    });
    expect(charts[1]).toMatchObject({ responses: 2, multiSelect: true, options: [{ label: 'Cost', count: 2 }, { label: 'Efficacy', count: 1 }] });
  });

  it('labels keys readably', () => {
    expect(questionLabel('q1_practice_setting')).toBe('Practice setting');
    expect(questionLabel('yearsInPractice')).toBe('Years in practice');
  });
});

describe('fitToLimit', () => {
  it('keeps everything when it fits', () => {
    expect(fitToLimit(['A', 'B'], 'T', 100)).toBe('A\n\nB\n\nT');
  });

  it('trims only the transcripts and marks the cut', () => {
    const out = fitToLimit(['HEAD'], 'x'.repeat(500), 120);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.startsWith('HEAD\n\n')).toBe(true);
    expect(out).toContain('[Transcript truncated to fit the input limit.]');
  });
});

describe('estimateCostUsd', () => {
  it('prices a run at Claude Sonnet 5 list rates', () => {
    expect(estimateCostUsd({ tokensInput: 23571, tokensOutput: 8192 })).toBe('~$0.129');
  });

  it('says unknown without usage', () => {
    expect(estimateCostUsd({})).toBe('cost unknown');
  });
});
