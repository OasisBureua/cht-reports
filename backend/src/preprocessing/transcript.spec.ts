import {
  cleanTranscriptText,
  splitPrerecordedLivestream,
  parseTranscriptText,
} from './transcript';
import { stripHonorific, kolFullName } from './kol-name';

describe('cleanTranscriptText', () => {
  it('strips filler words and normalizes whitespace', () => {
    const raw =
      "Um, really, really exciting, uh, data. Uh, so let's talk about the trial design.";
    expect(cleanTranscriptText(raw)).toBe(
      "really, really exciting, data. so let's talk about the trial design.",
    );
  });

  it('is idempotent (does not mangle already-clean text)', () => {
    const clean = 'This is already clean text.';
    expect(cleanTranscriptText(clean)).toBe(clean);
  });
});

describe('splitPrerecordedLivestream', () => {
  it('splits on a real Q&A marker when both halves are substantial', () => {
    const pre = Array(60).fill('word').join(' ');
    const live = 'Q&A ' + Array(60).fill('word').join(' ');
    const combined = `${pre}\n${live}`;

    const result = splitPrerecordedLivestream(combined);
    expect(result.livestream).not.toBeNull();
    expect(result.prerecorded.trim().endsWith('word')).toBe(true);
    expect(result.livestream!.startsWith('Q&A')).toBe(true);
  });

  it('does not split when the resulting halves are too short', () => {
    const combined = 'Short intro. Q&A. Short outro.';
    const result = splitPrerecordedLivestream(combined);
    expect(result.livestream).toBeNull();
    expect(result.prerecorded).toBe(combined);
  });

  it('does not split when no marker is present', () => {
    const combined = Array(200).fill('word').join(' ');
    const result = splitPrerecordedLivestream(combined);
    expect(result.livestream).toBeNull();
  });
});

describe('parseTranscriptText', () => {
  it('produces a plausible word count on cleaned text', () => {
    const raw = 'Um, this is, uh, a test transcript with some filler words.';
    const result = parseTranscriptText(raw);
    expect(result.rawText).toBe(raw);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.wordCount).toBeLessThan(raw.split(/\s+/).length);
  });
});

describe('stripHonorific / kolFullName', () => {
  it('strips a single honorific', () => {
    expect(stripHonorific('Dr. Pegram')).toBe('Pegram');
  });

  it('strips a doubled honorific', () => {
    expect(stripHonorific('Dr. Dr. Pegram')).toBe('Pegram');
  });

  it('is a no-op on a name with no honorific', () => {
    expect(stripHonorific('Pegram')).toBe('Pegram');
  });

  it('renders a canonical Dr. <name> form regardless of input prefix', () => {
    expect(kolFullName('Dr. Mark Pegram')).toBe('Dr. Mark Pegram');
    expect(kolFullName('Mark Pegram')).toBe('Dr. Mark Pegram');
  });
});

describe('cleanTranscriptText against a real messy CHM transcript excerpt', () => {
  it('handles heavy filler words without leaving stray punctuation', () => {
    const real =
      "Um, really, really exciting, uh, data. Uh, so let's talk about the trial design. " +
      "Uh, destiny Breast 11, as you mentioned, is a neoadjuvant study, uh, that really " +
      "asks the question of whether we can, uh, replace, uh, anthracycline, uh, with, uh, " +
      "trastuzumab Deruxtecan for high risk. Her two amplifi, two amplified, um, uh, " +
      "breast cancer, uh, primary breast cancer.";

    const cleaned = cleanTranscriptText(real);

    // No leftover filler words
    expect(cleaned).not.toMatch(/\b(um|uh)\b/i);
    // No stray leading commas / double punctuation left by removal
    expect(cleaned).not.toMatch(/,\s*,/);
    expect(cleaned).not.toMatch(/^\s*,/);
    // Real content survives untouched, including the garbled medical terms
    // this module deliberately does not try to fix
    expect(cleaned).toContain('destiny Breast 11');
    expect(cleaned).toContain('trastuzumab Deruxtecan');
    expect(cleaned).toContain('Her two amplifi, two amplified');
  });
});
