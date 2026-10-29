import { chartSlide, paginate, ReportDocService, SECTION_IDS, TRANSCRIPT_KOLS_NOTE } from './report-doc.service';
import { BUILTIN_HTML_TEMPLATE } from '../templates/builtin';
import type { ExecutiveSummaryContent, GeneratedNarrative, SocialChannelSummary } from '../content/executive-summary';

const narrative: GeneratedNarrative = {
  programTitle: 'HER2-Low Update',
  format: null,
  executiveSummary: [{ claim: 'First-line choice now carries the most weight.', body: '' }],
  objectives: [{ title: 'Review DESTINY-Breast06 outcomes', detail: 'Covered PFS by HER2 status.' }],
  kols: [{ name: 'Dr. VK Gadi', affiliation: 'University of Illinois Cancer Center' }],
  overview: ['A live webinar conversation.'],
  overviewHighlights: ['Discussion of HER2-low testing'],
  keyTakeaways: [{ claim: 'Testing is shifting.', body: 'Ultra-low is flagged routinely.' }],
  quotes: [
    { text: 'It was surprising.', speaker: 'Dr. Yan', source: 'faculty' },
    { text: 'I will retest more often.', speaker: 'Attendee', source: 'attendee' },
  ],
  conversationSummary: [],
  hcpEngagementThemes: [{ theme: 'Re-testing', detail: 'HCPs asked when to re-biopsy.' }],
  questionSummaries: [],
  audienceInsights: [{ label: 'Highest curiosity', body: 'ADC sequencing.' }],
  surveyTakeaways: [{ theme: 'Testing habits are changing', points: ['75% (n=4) practice in the community.'] }],
  conclusions: [{ claim: 'Make toxicity operational.', body: 'Comfort rises with playbooks.', recommendation: null }],
  nextSteps: [
    { claim: 'Ship a one-page algorithm.', body: 'For community sites.' },
    { claim: 'Run a follow-up session.', body: 'On sequencing.' },
    { claim: 'Equip the field team.', body: 'With testing resources.' },
  ],
};

const content: ExecutiveSummaryContent = {
  title: 'Executive Summary: HER2-Low Update',
  campaignName: '[TEST] Webinar 2',
  variant: 'webinar_only',
  hasQa: true,
  generatedAt: '2026-10-14T15:00:00Z',
  sessions: [{ title: 'Webinar 2', kind: 'WEBINAR', date: '2026-05-01T22:00:00Z' }],
  narrative,
  surveyCharts: [
    { question: 'Practice setting', responses: 4, multiSelect: false, options: [{ label: 'Community', count: 3 }, { label: 'Academic', count: 1 }] },
  ],
  surveyResponseCount: 4,
  surveyFreeText: [{ question: 'What will you change?', answers: ['Retest at progression.', 'Call patients on day 10.'] }],
  kols: narrative.kols,
  kolSource: 'transcript',
  attendees: null,
  // Content stored before CPR-50 carries this note; new content lists sources in `inputs`.
  inputCompletenessNote: 'The following sources were unavailable: hubspot: missing.',
};

/** Section ids of the rendered slides, in order. */
function slideOrder(html: string): string[] {
  return [...html.matchAll(/class="slide section-(\w+)/g)].map((m) => m[1]);
}

describe('ReportDocService', () => {
  const service = new ReportDocService();

  it('renders a full deck with the cover facts', async () => {
    const html = await service.renderExecutiveSummary(content);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Executive Summary: HER2-Low Update</title>');
    expect(html).toContain('<h1>HER2-Low Update</h1>');
    expect(html).toContain('<p class="cover-kols">Dr. VK Gadi</p>');
    expect(html).toContain('Live · May 1, 2026 at 6:00 PM EDT');
    expect(html).toContain('<p class="cover-format">Live webinar with real-time Q&amp;A</p>');
    expect(html).toContain('Updated with survey insights');
    expect(html).toContain('October 2026');
  });

  it('takes the cover format from the sessions, not the model', async () => {
    const recorded = await service.renderExecutiveSummary({
      ...content,
      variant: 'pre_record_only',
      narrative: { ...narrative, format: 'live_webinar' },
    });
    expect(recorded).toContain('<p class="cover-format">Pre-recorded conversation</p>');
    expect(recorded).toContain('<h2>Program Overview</h2>');
    expect(recorded).toContain('<h2>Program Objectives</h2>');
    const live = await service.renderExecutiveSummary({ ...content, narrative: { ...narrative, format: 'pre_recorded_and_live' } });
    expect(live).not.toContain('Pre-recorded');
  });

  it('renders slides in the delivered report order and leaves out empty sections', async () => {
    const html = await service.renderExecutiveSummary(content);
    expect(slideOrder(html)).toEqual([
      'executiveSummary',
      'disclosures',
      'kols',
      'objectives',
      'overview',
      'keyTakeaways',
      'quotes',
      'hcpEngagement',
      'audienceInsights',
      'divider',
      'surveyResults',
      'surveyComments',
      'surveyTakeaways',
      'conclusions',
      'nextSteps',
      'closing',
    ]);
    expect(html).toContain('<h2>Post Webinar Survey Results</h2><p>4 responses</p>');
  });

  it('puts the left-out sections and source notes in internal notes the PDF hides', async () => {
    const html = await service.renderExecutiveSummary(content);
    expect(html).toContain('<section class="internal-notes">');
    expect(html).toContain('hubspot: missing');
    expect(html).toContain('Not included for lack of input data: Attendees, Summary of Conversation, Question Summaries, Social Performance.');
    expect(BUILTIN_HTML_TEMPLATE).toMatch(/@media print \{.*\.internal-notes \{ display: none; \}/);
  });

  it('lists every source with row counts and fetch times internally (CPR-50)', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      inputs: [
        { source: 'zoom', status: 'ok', rowCount: 3, fetchedAt: '2026-10-15T18:04:59.123Z' },
        { source: 'hubspot', status: 'missing', rowCount: 0, fetchedAt: null },
      ],
    });
    const notes = html.slice(html.indexOf('internal-notes'));
    expect(notes).toContain('<th style="text-align:left;padding:2px 16px 2px 0">Fetched (UTC)</th>');
    expect(notes).toMatch(/<td[^>]*>zoom<\/td><td[^>]*>ok<\/td><td[^>]*>3<\/td><td[^>]*>2026-10-15 18:04<\/td>/);
    expect(notes).toMatch(/<td[^>]*>hubspot<\/td><td[^>]*>missing<\/td><td[^>]*>0<\/td><td[^>]*>never<\/td>/);
  });

  it('notes the edit instructions a revised version followed (CPR-52)', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      revision: { previousVersion: 1, instructions: 'Lead with <survey> results', previousLoaded: true },
    });
    expect(html.slice(html.indexOf('internal-notes'))).toContain(
      'Version 2, revised with these instructions: &quot;Lead with &lt;survey&gt; results&quot;.',
    );

    const fresh = await service.renderExecutiveSummary({
      ...content,
      revision: { previousVersion: 1, instructions: 'Shorter', previousLoaded: false },
    });
    expect(fresh).toContain('(v1 could not be included, so it was written fresh).');
  });

  it('notes machine transcripts and recording-sourced KOLs internally', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      transcriptNote: 'Transcripts are machine-generated by Zoom and may contain errors in names and terms.',
    });
    const notes = html.slice(html.indexOf('internal-notes'));
    expect(notes).toContain('Transcripts are machine-generated by Zoom');
    expect(notes).toContain(TRANSCRIPT_KOLS_NOTE);
  });

  it('renders Hub KOLs without the recording note', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      kols: [{ name: 'Dr. Ana Ruiz', affiliation: 'MD, Dana-Farber' }],
      kolSource: 'hub',
    });
    expect(html).toContain('<div class="kol-avatar">AR</div><div class="kol-band"><strong>Dr. Ana Ruiz</strong><span>MD, Dana-Farber</span></div>');
    expect(html).not.toContain('Dr. VK Gadi');
    expect(html).not.toContain(TRANSCRIPT_KOLS_NOTE);
  });

  it('names the conversation divider after two or three KOLs', async () => {
    const two = await service.renderExecutiveSummary({
      ...content,
      kols: [
        { name: 'Dr. A One', affiliation: null },
        { name: 'Dr. B Two', affiliation: null },
      ],
      narrative: { ...narrative, conversationSummary: [{ claim: 'C', body: 'D' }] },
    });
    expect(two).toContain('<h2>Conversation between Dr. A One &amp; Dr. B Two</h2>');
  });

  it('attributes faculty quotes and labels attendee comments', async () => {
    const html = await service.renderExecutiveSummary(content);
    expect(html).toContain('<blockquote><p>It was surprising.</p><cite>Dr. Yan</cite></blockquote>');
    expect(html).toContain('<blockquote><p>I will retest more often.</p><cite>Attendee</cite></blockquote>');
  });

  it('renders verbatim survey comments, survey takeaways and next steps', async () => {
    const html = await service.renderExecutiveSummary(content);
    expect(html).toContain('<h2>What will you change?</h2>');
    expect(html).toContain('<blockquote><p>“Call patients on day 10.”</p></blockquote>');
    expect(html).toContain('<h3>Testing habits are changing</h3><ul><li>75% (n=4) practice in the community.</li></ul>');
    expect(html).toContain('<h3>Ship a one-page algorithm.</h3><p>For community sites.</p>');
    expect(html).toContain('class="step step-3"');
  });

  it('keeps a recommendation from content written by older templates', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      narrative: { ...narrative, conclusions: [{ claim: 'X', body: 'Y', recommendation: 'Ship it.' }] },
    });
    expect(html).toContain('<p class="recommendation">Recommendation: Ship it.</p>');
  });

  it('renders content from 1.2.0 (string objectives, no new keys)', async () => {
    const old = { ...narrative, objectives: ['Review A'] } as Partial<GeneratedNarrative>;
    delete old.surveyTakeaways;
    delete old.nextSteps;
    delete old.overviewHighlights;
    const html = await service.renderExecutiveSummary({ ...content, narrative: old as GeneratedNarrative });
    expect(html).toContain('<li><strong>Review A</strong></li>');
    expect(slideOrder(html)).not.toContain('nextSteps');
  });

  it('renders only the requested sections', async () => {
    const html = await service.renderExecutiveSummary(content, { sections: ['keyTakeaways'] });
    expect(html).toContain('<h2>Key Takeaways</h2>');
    expect(html).not.toContain('<h2>Webinar Objectives</h2>');
  });

  it('escapes model text', async () => {
    const html = await service.renderExecutiveSummary({
      ...content,
      narrative: { ...narrative, overview: ['<script>alert(1)</script> & more'] },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more');
  });

  it('fills a custom template and keeps $ in content literal', async () => {
    const html = await service.renderExecutiveSummary(
      { ...content, narrative: { ...narrative, overview: ['Costs $1 and $& stays'] } },
      { htmlTemplate: '<article>{{cover}}{{sections}}{{closing}}{{inputCompleteness}}{{unknown}}</article>' },
    );
    expect(html.startsWith('<article>')).toBe(true);
    expect(html).toContain('Costs $1 and $&amp; stays');
    expect(html).toContain('{{unknown}}');
  });

  describe('attendees', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ specialty: 'Oncology', institution: `Clinic ${i + 1}` }));

    it('lists one row per attendee with no names, under the attendance figures', async () => {
      const html = await service.renderExecutiveSummary({
        ...content,
        attendees: { registered: 40, attended: 30, avgMinutesWatched: 42, bySpecialty: [], byInstitution: [], rows: rows(3) },
      });
      expect(html).toContain('<h2>Attendees – Live Webinar (1–3)</h2>');
      expect(html).toContain('<dt>Registered</dt><dd>40</dd>');
      expect(html).toContain('<dt>Attended</dt><dd>30 (75%)</dd>');
      expect(html).toContain('<dt>Average minutes watched</dt><dd>42</dd>');
      expect(html).toContain('<td>Oncology</td><td>Clinic 3</td>');
    });

    it('spreads rows evenly over slides', async () => {
      const html = await service.renderExecutiveSummary({
        ...content,
        attendees: { registered: 30, attended: 25, avgMinutesWatched: null, bySpecialty: [], byInstitution: [], rows: rows(25) },
      });
      expect(html).toContain('(1–9)</h2>');
      expect(html).toContain('(10–18)</h2>');
      expect(html).toContain('(19–25)</h2>');
      expect(html).not.toContain('Average minutes watched');
    });

    it('shows counts instead of rows for a large audience', async () => {
      const html = await service.renderExecutiveSummary({
        ...content,
        attendees: {
          registered: 120,
          attended: 90,
          avgMinutesWatched: null,
          bySpecialty: [{ label: 'Oncology', count: 90 }],
          byInstitution: [{ label: 'Mayo Clinic', count: 5 }],
          rows: rows(90),
        },
      });
      expect(html).toContain('<tr><td>Oncology</td><td>90</td></tr>');
      expect(html).not.toContain('Clinic 1<');
    });
  });

  describe('social performance', () => {
    const youtube: SocialChannelSummary = {
      channel: 'youtube',
      label: 'YouTube',
      posts: 2,
      paidPosts: 0,
      organic: { views: 1600, likes: 16, comments: 3 },
      paid: {},
      asOf: '2026-10-20',
      topPosts: [
        { title: 'Big video', postedAt: '2026-10-02T15:00:00Z', paid: false, metrics: { views: 1500, likes: 15, comments: 3 } },
        { title: 'Small <video>', postedAt: null, paid: false, metrics: { views: 100, likes: 1 } },
      ],
    };
    const linkedin: SocialChannelSummary = {
      channel: 'linkedin',
      label: 'LinkedIn',
      posts: 2,
      paidPosts: 1,
      organic: { clicks: 7 },
      paid: { impressions: 1000, clicks: 10, engagements: 20, videoViews: 100, ctr: 0.01 },
      asOf: '2026-10-20',
      topPosts: [
        { title: 'Boost', postedAt: null, paid: true, metrics: { impressions: 1000, clicks: 10, engagements: 20 } },
        { title: 'Organic post', postedAt: null, paid: false, metrics: { clicks: 7 } },
      ],
    };

    it('renders one slide per channel before the strategic takeaways', async () => {
      const html = await service.renderExecutiveSummary({ ...content, social: { channels: [youtube, linkedin], notes: [] } });
      const order = slideOrder(html);
      expect(order.filter((s) => s === 'socialPerformance')).toHaveLength(2);
      expect(order.indexOf('socialPerformance')).toBe(order.indexOf('conclusions') - 2);
      expect(html).toContain('<h2>Social Performance – YouTube</h2>');
      expect(html).toContain('<dt>Lifetime views</dt><dd>1,600</dd>');
      expect(html).toContain('<td style="width:44%">Big video</td><td style="white-space:nowrap">Oct 2, 2026</td><td>1,500</td><td>15</td><td>3</td>');
      expect(html).toContain('<td style="width:44%">Small &lt;video&gt;</td><td style="white-space:nowrap">–</td><td>100</td><td>1</td><td>–</td>');
      expect(html).toContain('<p class="chart-note">Lifetime views as of Oct 20, 2026.</p>');
      expect(html).not.toContain('Social Performance.</p>');
    });

    it('shows paid totals with click-through rate and marks paid posts', async () => {
      const html = await service.renderExecutiveSummary({ ...content, social: { channels: [linkedin], notes: [] } });
      expect(html).toContain('<dt>Posts</dt><dd>2 (1 paid)</dd>');
      expect(html).toContain('<dt>Paid impressions</dt><dd>1,000</dd>');
      expect(html).toContain('<dt>Organic clicks</dt><dd>7</dd>');
      expect(html).toContain('<dt>Paid CTR</dt><dd>1.0%</dd>');
      expect(html).toContain('<th>Type</th>');
      expect(html).toContain('<td style="width:44%">Boost</td><td style="white-space:nowrap">–</td><td>Paid</td><td>1,000</td><td>10</td><td>20</td>');
      expect(html).toContain('As of Oct 20, 2026.');
      expect(html).not.toMatch(/cost|spend/i);
    });

    it('shows views gained in the period when Hub has it for the channel', async () => {
      const gained: SocialChannelSummary = {
        ...youtube,
        organic: { ...youtube.organic, viewsGained: 600 },
        topPosts: [{ ...youtube.topPosts[0], metrics: { ...youtube.topPosts[0].metrics, viewsGained: 600 } }],
      };
      const html = await service.renderExecutiveSummary({ ...content, social: { channels: [gained], notes: [] } });
      expect(html).toContain('<dt>Views in period</dt><dd>600</dd>');
      expect(html).not.toContain('<dt>Lifetime views</dt>');
      expect(html).not.toContain('Lifetime views as of');
    });

    it('shows each post\'s views in the period when the channel total is lifetime', async () => {
      // One post has a baseline and one does not, so Hub sends no channel total.
      const mixed: SocialChannelSummary = {
        ...youtube,
        topPosts: [
          { ...youtube.topPosts[0], metrics: { ...youtube.topPosts[0].metrics, viewsGained: 600 } },
          youtube.topPosts[1],
        ],
      };
      const html = await service.renderExecutiveSummary({ ...content, social: { channels: [mixed], notes: [] } });
      expect(html).toContain('<dt>Lifetime views</dt><dd>1,600</dd>');
      expect(html).toContain('<th>Views in period</th><th>Lifetime views</th><th>Likes</th>');
      expect(html).toContain('<td style="width:44%">Big video</td><td style="white-space:nowrap">Oct 2, 2026</td><td>600</td><td>1,500</td><td>15</td>');
      expect(html).toContain('<td style="width:44%">Small &lt;video&gt;</td><td style="white-space:nowrap">–</td><td>–</td><td>100</td><td>1</td>');
      expect(html).toContain(
        'Lifetime views as of Oct 20, 2026. Views in period need a snapshot from before the period or a publish date inside it.',
      );
    });
  });

  describe('Q&A note', () => {
    it('replaces the empty Q&A sections with the Q&A capture note', async () => {
      const html = await service.renderExecutiveSummary({
        ...content,
        qaNote: 'Live Q&A capture is not available yet.',
        narrative: { ...narrative, hcpEngagementThemes: [], questionSummaries: [], audienceInsights: [] },
      });
      expect(html).toContain('Live Q&amp;A capture is not available yet.');
      expect(html).toContain('Not included for lack of input data: Attendees, Summary of Conversation, Social Performance.');
    });

    it('keeps the generic note when some Q&A sections rendered', async () => {
      const html = await service.renderExecutiveSummary({ ...content, qaNote: 'Live Q&A capture is not available yet.' });
      expect(html).not.toContain('Live Q&amp;A capture');
    });
  });

  it('exposes every section, in the delivered report order', () => {
    expect(SECTION_IDS).toHaveLength(18);
    expect(SECTION_IDS[0]).toBe('executiveSummary');
    expect(SECTION_IDS[SECTION_IDS.length - 1]).toBe('nextSteps');
  });
});

describe('chartSlide', () => {
  it('draws a pie with a legend of counts and percentages', () => {
    const html = chartSlide({
      question: 'Practice setting',
      responses: 4,
      multiSelect: false,
      options: [
        { label: 'Community', count: 3 },
        { label: 'Academic', count: 1 },
        { label: 'Hybrid', count: 0 },
      ],
    });
    expect(html).toContain('<h2>Practice setting (4 responses)</h2>');
    expect(html).toContain('<svg class="pie"');
    expect(html).toContain('<span class="opt">Community</span><span class="val">3 · 75%</span>');
    expect(html).toContain('<li class="zero">');
  });

  it('draws labelled bars for multi-select, as a share of respondents', () => {
    const html = chartSlide({
      question: 'Barriers',
      responses: 8,
      multiSelect: true,
      options: [{ label: 'Cost', count: 4 }],
    });
    expect(html).toContain('<span class="opt">Cost</span>');
    expect(html).toContain('width:50%');
    expect(html).toContain('4 · 50%');
    expect(html).toContain('Multiple answers allowed');
  });
});

describe('paginate', () => {
  it('splits by size and item cap, then balances the slides', () => {
    const pages = paginate([5, 5, 5, 5, 5], (n) => n, 20, 10);
    expect(pages.map((p) => p.length)).toEqual([3, 2]);
    expect(paginate([1, 1, 1, 1, 1], () => 1, 100, 2).map((p) => p.length)).toEqual([2, 2, 1]);
  });

  it('gives an oversized item a slide of its own', () => {
    expect(paginate([50, 1], (n) => n, 10, 5)).toEqual([[50], [1]]);
  });
});
