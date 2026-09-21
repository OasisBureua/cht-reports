import { ReportDocService, ExecutiveSummaryContent } from './report-doc.service';

describe('ReportDocService', () => {
  let service: ReportDocService;

  beforeEach(() => {
    service = new ReportDocService();
  });

  const baseContent: ExecutiveSummaryContent = {
    title: 'Executive Summary: Campaign 42',
    variant: 'webinar_only',
    sections: [{ heading: 'Overview', paragraphs: ['First paragraph.', 'Second paragraph.'] }],
    inputCompletenessNote: null,
  };

  it('renders a well-formed HTML document', async () => {
    const html = await service.renderExecutiveSummary(baseContent);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('</html>');
  });

  it('includes the title in both the head and body', async () => {
    const html = await service.renderExecutiveSummary(baseContent);

    expect(html).toContain('<title>Executive Summary: Campaign 42</title>');
    expect(html).toContain('<h1>Executive Summary: Campaign 42</h1>');
  });

  it('renders each section heading and its paragraphs', async () => {
    const html = await service.renderExecutiveSummary(baseContent);

    expect(html).toContain('<h2>Overview</h2>');
    expect(html).toContain('<p>First paragraph.</p>');
    expect(html).toContain('<p>Second paragraph.</p>');
  });

  it('renders multiple sections in order', async () => {
    const content: ExecutiveSummaryContent = {
      ...baseContent,
      sections: [
        { heading: 'First', paragraphs: ['A.'] },
        { heading: 'Second', paragraphs: ['B.'] },
      ],
    };

    const html = await service.renderExecutiveSummary(content);
    const firstIndex = html.indexOf('First');
    const secondIndex = html.indexOf('Second');

    expect(firstIndex).toBeGreaterThan(-1);
    expect(secondIndex).toBeGreaterThan(firstIndex);
  });

  it('omits the input completeness section when there is no note', async () => {
    const html = await service.renderExecutiveSummary(baseContent);

    expect(html).not.toContain('Input Completeness');
  });

  it('renders the input completeness note when present', async () => {
    const content: ExecutiveSummaryContent = {
      ...baseContent,
      inputCompletenessNote: 'survey_responses: missing',
    };

    const html = await service.renderExecutiveSummary(content);

    expect(html).toContain('Input Completeness');
    expect(html).toContain('survey_responses: missing');
  });

  it('escapes HTML special characters in title, headings, and paragraphs', async () => {
    const content: ExecutiveSummaryContent = {
      title: 'Report <2026> & "Special"',
      variant: 'pre_record_only',
      sections: [{ heading: 'A & B', paragraphs: ['5 < 10 and 10 > 5'] }],
      inputCompletenessNote: "It's <complicated>",
    };

    const html = await service.renderExecutiveSummary(content);

    expect(html).not.toContain('<2026>');
    expect(html).toContain('&lt;2026&gt;');
    expect(html).toContain('&amp;');
    expect(html).toContain('5 &lt; 10 and 10 &gt; 5');
    expect(html).toContain('&#39;s &lt;complicated&gt;');
  });
});
