/**
 * CPR-46: the Attendees section, built in code from the packet's attendance
 * metrics (CPR-42). Attendees are counted by specialty and institution from
 * their profiles; no names reach the report or the model.
 */

import type { ReportInputPacket } from '../packet/report-packet.types';
import type { AttendeesSummary, CountRow } from './executive-summary';

/** Institutions beyond this many are grouped as "Other institutions". */
const MAX_INSTITUTIONS = 10;
export const NOT_PROVIDED = 'Not provided';

function count(values: (string | null)[]): CountRow[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = value?.trim() || NOT_PROVIDED;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, n]) => ({ label, count: n }))
    .sort(
      (a, b) =>
        Number(a.label === NOT_PROVIDED) - Number(b.label === NOT_PROVIDED) ||
        b.count - a.count ||
        a.label.localeCompare(b.label),
    );
}

function capped(rows: CountRow[], max: number): CountRow[] {
  if (rows.length <= max) return rows;
  const rest = rows.slice(max - 1).reduce((sum, r) => sum + r.count, 0);
  return [...rows.slice(0, max - 1), { label: 'Other institutions', count: rest }];
}

function num(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildAttendeesSummary(packet: ReportInputPacket): AttendeesSummary | null {
  const attendees = packet.attendees ?? [];
  const registered = num(packet.registeredCount);
  const attended = num(packet.attendedCount) ?? (attendees.length || null);
  const avgMinutesWatched = num(packet.avgMinutesWatched);
  if (registered === null && attended === null && attendees.length === 0) return null;

  return {
    registered,
    attended,
    avgMinutesWatched: avgMinutesWatched === null ? null : Math.round(avgMinutesWatched),
    bySpecialty: count(attendees.map((a) => a.specialty)),
    byInstitution: capped(
      count(attendees.map((a) => a.institution)),
      MAX_INSTITUTIONS,
    ),
  };
}

/** Plain-text summary for the model: counts only. */
export function attendeesContext(summary: AttendeesSummary | null): string {
  if (!summary) return 'none';
  const lines = [
    summary.registered !== null ? `Registered: ${summary.registered}` : null,
    summary.attended !== null ? `Attended: ${summary.attended}` : null,
    summary.avgMinutesWatched !== null ? `Average minutes watched: ${summary.avgMinutesWatched}` : null,
    summary.bySpecialty.length
      ? `Attendees by specialty: ${summary.bySpecialty.map((r) => `${r.label} (n=${r.count})`).join(', ')}`
      : null,
    summary.byInstitution.length
      ? `Attendees by institution: ${summary.byInstitution.map((r) => `${r.label} (n=${r.count})`).join(', ')}`
      : null,
  ];
  return lines.filter(Boolean).join('\n');
}
