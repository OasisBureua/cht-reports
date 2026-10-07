import type { ReportPacketSession } from './report-packet.types';

/**
 * Sessions whose Zoom transcript is probably still on its way (CPR-47): no
 * transcript text yet, and the session happened within `recentHours`. Older
 * sessions without a transcript are not waited for; the report notes them.
 */
export function pendingTranscripts(
  sessions: ReportPacketSession[],
  now: Date,
  recentHours: number,
): ReportPacketSession[] {
  return sessions.filter((session) => {
    if ((session.transcriptText ?? '').trim()) return false;
    if (!session.sessionDate) return false;
    const held = Date.parse(session.sessionDate);
    if (Number.isNaN(held)) return false;
    return now.getTime() - held < recentHours * 3_600_000;
  });
}
