import { pendingTranscripts } from './transcript-wait';
import type { ReportPacketSession } from './report-packet.types';

const now = new Date('2026-10-15T20:00:00Z');

function s(sessionDate: string | null, transcriptText = ''): ReportPacketSession {
  return { platformToolProgramId: 'p', kind: 'webinar', title: 'T', sessionDate, zoomMeetingUuid: null, transcriptText };
}

describe('pendingTranscripts', () => {
  it('waits for a session from the last 24 hours with no transcript', () => {
    expect(pendingTranscripts([s('2026-10-15T18:00:00Z')], now, 24)).toHaveLength(1);
  });

  it('does not wait once the transcript is in, or for older or undated sessions', () => {
    expect(pendingTranscripts([s('2026-10-15T18:00:00Z', 'WEBVTT')], now, 24)).toHaveLength(0);
    expect(pendingTranscripts([s('2026-10-13T18:00:00Z')], now, 24)).toHaveLength(0);
    expect(pendingTranscripts([s(null), s('not a date')], now, 24)).toHaveLength(0);
  });

  it('treats whitespace-only transcript text as missing', () => {
    expect(pendingTranscripts([s('2026-10-15T18:00:00Z', '  \n ')], now, 24)).toHaveLength(1);
  });
});
