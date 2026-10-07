import { attendeesContext, buildAttendeesSummary, NOT_PROVIDED } from './attendees';
import type { ReportInputPacket } from '../packet/report-packet.types';

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

describe('buildAttendeesSummary', () => {
  it('is null when the packet has no attendance metrics', () => {
    expect(buildAttendeesSummary(base)).toBeNull();
  });

  it('counts attendees by specialty and institution', () => {
    const summary = buildAttendeesSummary({
      ...base,
      registeredCount: 12,
      attendedCount: 4,
      avgMinutesWatched: 37.6,
      attendees: [
        { specialty: 'Oncology', institution: 'Mayo Clinic', minutesWatched: 50 },
        { specialty: 'Oncology', institution: 'UCSF', minutesWatched: 40 },
        { specialty: null, institution: ' ', minutesWatched: 30 },
        { specialty: 'Pathology', institution: 'Mayo Clinic', minutesWatched: 30 },
      ],
    });
    expect(summary).toEqual({
      registered: 12,
      attended: 4,
      avgMinutesWatched: 38,
      bySpecialty: [
        { label: 'Oncology', count: 2 },
        { label: 'Pathology', count: 1 },
        { label: NOT_PROVIDED, count: 1 },
      ],
      byInstitution: [
        { label: 'Mayo Clinic', count: 2 },
        { label: 'UCSF', count: 1 },
        { label: NOT_PROVIDED, count: 1 },
      ],
    });
  });

  it('groups institutions past the top ten', () => {
    const attendees = Array.from({ length: 12 }, (_, i) => ({
      specialty: 'Oncology',
      institution: `Hospital ${String(i).padStart(2, '0')}`,
      minutesWatched: 10,
    }));
    const summary = buildAttendeesSummary({ ...base, attendees });
    expect(summary?.attended).toBe(12);
    expect(summary?.byInstitution).toHaveLength(10);
    expect(summary?.byInstitution[9]).toEqual({ label: 'Other institutions', count: 3 });
  });

  it('gives the model counts only', () => {
    const text = attendeesContext(
      buildAttendeesSummary({
        ...base,
        registeredCount: 5,
        attendees: [{ specialty: 'Oncology', institution: 'UCSF', minutesWatched: 10 }],
      }),
    );
    expect(text).toContain('Registered: 5');
    expect(text).toContain('Attendees by specialty: Oncology (n=1)');
    expect(attendeesContext(null)).toBe('none');
  });
});
