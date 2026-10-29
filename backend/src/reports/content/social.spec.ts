import { buildSocialSummary, formatMetric, organicMetrics, postMetrics, socialContext } from './social';
import type { ReportInputPacket, ReportPacketSocialChannel } from '../packet/report-packet.types';

const base: ReportInputPacket = {
  campaignId: 1,
  campaignName: 'F&F',
  windowStart: null,
  windowEnd: null,
  sources: [],
  hubspotRawData: null,
  platformSlices: [],
  sessions: [],
  surveyResponses: [],
  inputCompleteness: {},
};

function channel(overrides: Partial<ReportPacketSocialChannel>): ReportPacketSocialChannel {
  return {
    channel: 'youtube',
    posts: 1,
    paidPosts: 0,
    organic: {},
    paid: {},
    metricSources: {},
    asOf: null,
    topPosts: [],
    ...overrides,
  };
}

function packet(channels: ReportPacketSocialChannel[], notes: string[] = []): ReportInputPacket {
  return { ...base, socialPerformance: { linkedPosts: channels.length, postsWithMetrics: channels.length, channels, notes } };
}

describe('buildSocialSummary', () => {
  it('is null without a social block or channels with numbers', () => {
    expect(buildSocialSummary(base)).toBeNull();
    expect(buildSocialSummary({ ...base, socialPerformance: null })).toBeNull();
    expect(buildSocialSummary(packet([channel({})]))).toBeNull();
  });

  it('labels channels, drops non-numbers and shortens long titles', () => {
    const summary = buildSocialSummary(
      packet([
        channel({
          organic: { views: 10, likes: Number.NaN },
          topPosts: [
            { postId: 'a', title: 'x'.repeat(100), url: null, postedAt: null, paid: false, metrics: { views: 10 } },
            { postId: 'b', title: '  ', url: null, postedAt: null, paid: false, metrics: {} },
          ],
        }),
        channel({ channel: 'other', paid: { impressions: 5 } }),
      ]),
    );
    expect(summary?.channels.map((c) => c.label)).toEqual(['YouTube', 'Other channels']);
    expect(summary?.channels[0].organic).toEqual({ views: 10 });
    expect(summary?.channels[0].topPosts[0].title).toHaveLength(70);
    expect(summary?.channels[0].topPosts[1].title).toBe('Untitled post');
  });
});

describe('social metrics', () => {
  it('uses views gained in place of lifetime views when the channel has it', () => {
    const summary = buildSocialSummary(
      packet([
        channel({
          organic: { views: 1600, viewsGained: 600, likes: 16 },
          topPosts: [{ postId: 'a', title: 'A', url: null, postedAt: null, paid: false, metrics: { views: 1500, viewsGained: 600 } }],
        }),
      ]),
    )!;
    expect(organicMetrics(summary.channels[0])).toEqual(['viewsGained', 'likes']);
    expect(postMetrics(summary.channels[0], 3)).toEqual(['viewsGained']);
  });

  it('keeps each post\'s views gained when the channel total is lifetime', () => {
    const summary = buildSocialSummary(
      packet([
        channel({
          posts: 2,
          organic: { views: 1600, likes: 16 },
          asOf: '2026-10-20',
          topPosts: [
            { postId: 'a', title: 'A', url: null, postedAt: null, paid: false, metrics: { views: 1500, viewsGained: 600, likes: 15 } },
            { postId: 'b', title: 'B', url: null, postedAt: null, paid: false, metrics: { views: 100, likes: 1 } },
          ],
        }),
      ]),
    )!;
    const youtube = summary.channels[0];
    expect(organicMetrics(youtube)).toEqual(['views', 'likes']);
    expect(postMetrics(youtube, 3)).toEqual(['viewsGained', 'views', 'likes']);
    expect(socialContext(summary)).toBe(
      'YouTube: 2 posts, as of 2026-10-20; organic: Lifetime views 1,600, Likes 16. ' +
        'Top posts: "A" (Views in period 600, Likes 15); "B" (Lifetime views 100, Likes 1)',
    );
  });

  it('formats counts with separators and CTR as a percent', () => {
    expect(formatMetric('impressions', 12345.4)).toBe('12,345');
    expect(formatMetric('ctr', 0.0123)).toBe('1.2%');
  });

  it('summarizes organic and paid totals for the model, with the notes', () => {
    const summary = buildSocialSummary(
      packet(
        [
          channel({
            channel: 'linkedin',
            posts: 2,
            paidPosts: 1,
            organic: { clicks: 7 },
            paid: { impressions: 1000, clicks: 10, ctr: 0.01 },
            asOf: '2026-10-20',
          }),
        ],
        ['A note.'],
      ),
    );
    expect(socialContext(summary)).toBe(
      'LinkedIn: 2 posts (1 paid), as of 2026-10-20; organic: Clicks 7; paid: Impressions 1,000, Clicks 10, CTR 1.0%\nA note.',
    );
    expect(socialContext(null)).toBe('none');
  });
});
