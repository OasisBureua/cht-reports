/**
 * CPR-61: the Social Performance section, built in code from the packet's
 * social block (Content Hub's posts linked to the campaign). Hub picks one
 * source per metric and leaves ad spend out; this only formats.
 */

import type { ReportInputPacket } from '../packet/report-packet.types';
import type { SocialChannelSummary, SocialPerformanceSummary } from './executive-summary';

const CHANNEL_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  other: 'Other channels',
};

export const SOCIAL_METRIC_LABELS: Record<string, string> = {
  views: 'Views',
  viewsGained: 'Views in period',
  impressions: 'Impressions',
  clicks: 'Clicks',
  ctr: 'CTR',
  engagements: 'Engagements',
  likes: 'Likes',
  comments: 'Comments',
  videoViews: 'Video views',
  videoCompletions: 'Video completions',
};

/** Display order. `views` and `viewsGained` take the same place: see viewsMetric. */
const ORGANIC_ORDER = ['views', 'impressions', 'clicks', 'engagements', 'likes', 'comments', 'videoViews', 'videoCompletions'];
const PAID_ORDER = ['impressions', 'clicks', 'ctr', 'engagements', 'videoViews', 'videoCompletions'];

/** Two lines in the top-posts table. */
const MAX_TITLE = 70;

function finite(values: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function shorten(text: string): string {
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}…` : text;
}

export function buildSocialSummary(packet: ReportInputPacket): SocialPerformanceSummary | null {
  const social = packet.socialPerformance;
  const channels: SocialChannelSummary[] = (social?.channels ?? [])
    .map((c) => ({
      channel: c.channel,
      label: CHANNEL_LABELS[c.channel] ?? c.channel,
      posts: c.posts,
      paidPosts: c.paidPosts ?? 0,
      organic: finite(c.organic),
      paid: finite(c.paid),
      asOf: c.asOf ?? null,
      topPosts: (c.topPosts ?? []).map((p) => ({
        title: shorten(p.title?.trim() || 'Untitled post'),
        postedAt: p.postedAt ?? null,
        paid: Boolean(p.paid),
        metrics: finite(p.metrics),
      })),
    }))
    .filter((c) => Object.keys(c.organic).length || Object.keys(c.paid).length);
  if (!channels.length) return null;
  return { channels, notes: social?.notes ?? [] };
}

/**
 * Views gained in the window when Hub has it for every post of the channel
 * (it only sets the total then), else lifetime views.
 */
export function viewsMetric(channel: SocialChannelSummary): 'views' | 'viewsGained' {
  return 'viewsGained' in channel.organic ? 'viewsGained' : 'views';
}

/** Organic metrics to show, in display order. */
export function organicMetrics(channel: SocialChannelSummary): string[] {
  const views = viewsMetric(channel);
  return ORGANIC_ORDER.map((m) => (m === 'views' ? views : m)).filter((m) => m in channel.organic);
}

/** Paid metrics to show, in display order. Spend is never in the packet. */
export function paidMetrics(channel: SocialChannelSummary): string[] {
  return PAID_ORDER.filter((m) => m in channel.paid);
}

/** Metric columns for the top-posts table. */
export function postMetrics(channel: SocialChannelSummary, max: number): string[] {
  const views = viewsMetric(channel);
  return ORGANIC_ORDER.map((m) => (m === 'views' ? views : m))
    .filter((m) => channel.topPosts.some((p) => m in p.metrics))
    .slice(0, max);
}

export function formatMetric(metric: string, value: number): string {
  if (metric === 'ctr') return `${(value * 100).toFixed(1)}%`;
  return Math.round(value).toLocaleString('en-US');
}

function metricList(values: Record<string, number>, metrics: string[]): string {
  return metrics.map((m) => `${SOCIAL_METRIC_LABELS[m] ?? m} ${formatMetric(m, values[m])}`).join(', ');
}

/** Plain-text summary for the model: computed totals only, no spend. */
export function socialContext(summary: SocialPerformanceSummary | null): string {
  if (!summary) return 'none';
  const lines = summary.channels.map((c) => {
    const posts = `${c.posts} ${c.posts === 1 ? 'post' : 'posts'}${c.paidPosts ? ` (${c.paidPosts} paid)` : ''}`;
    const organic = organicMetrics(c);
    const paid = paidMetrics(c);
    const parts = [
      organic.length ? `organic: ${metricList(c.organic, organic)}` : null,
      paid.length ? `paid: ${metricList(c.paid, paid)}` : null,
    ].filter(Boolean);
    const top = c.topPosts[0];
    const topMetrics = top ? postMetrics({ ...c, topPosts: [top] }, 1) : [];
    return [
      `${c.label}: ${posts}${c.asOf ? `, as of ${c.asOf}` : ''}; ${parts.join('; ')}`,
      top && topMetrics.length ? `. Top post: "${top.title}" (${metricList(top.metrics, topMetrics)})` : '',
    ].join('');
  });
  return [...lines, ...summary.notes].join('\n');
}
