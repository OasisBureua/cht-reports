/**
 * Doctor/KOL name normalization. Ported from the prior CHM MediaHub report
 * pipeline (chm_report_automation/models.py, strip_honorific/kol_full_name).
 * Same known bug it fixed: raw transcripts and survey exports carry
 * inconsistent "Dr." / "Doctor" / "Prof." prefixes, sometimes doubled
 * ("Dr. Dr. Smith"). Idempotent so it's safe to call on already-clean names.
 */

const HONORIFIC_RE = /^\s*(?:dr\.?|doctor|prof\.?|professor)\s+/i;

export function stripHonorific(name: string): string {
  let prev = name;
  let out = name.replace(HONORIFIC_RE, '').trim();
  while (out !== prev && HONORIFIC_RE.test(out)) {
    prev = out;
    out = out.replace(HONORIFIC_RE, '').trim();
  }
  return out;
}

export function kolFullName(name: string, prefix = 'Dr. '): string {
  return `${prefix}${stripHonorific(name)}`;
}
