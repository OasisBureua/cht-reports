/**
 * Transcript cleaning and parsing. Ported from the prior CHM MediaHub
 * report pipeline (chm_report_automation/preprocessing.py), which was
 * validated end-to-end against real CHM webinar transcripts. Rewritten
 * from Python to TypeScript for this NestJS service; not a copy-paste.
 *
 * Raw session transcripts (chmbot legacy exports, Zoom .vtt files) are not
 * clean text: heavy filler words, no reliable speaker diarization, and
 * garbled medical/trial terminology (e.g. "her two amplifi, two amplified"
 * for HER2-amplified, "destiny breast 11" for the DESTINY-Breast11 trial).
 * This module produces clean text for the generation prompt. It does not
 * attempt drug/trial-name normalization; no such system exists anywhere in
 * the prior pipeline either, and building one (e.g. against a PubMed or
 * ClinicalTrials.gov lookup) is separate, undecided scope.
 */

export interface TranscriptSegment {
  speaker: string | null;
  text: string;
}

export interface ProcessedTranscript {
  rawText: string;
  segments: TranscriptSegment[];
  wordCount: number;
}

// Also consumes a trailing comma so "Um, really" doesn't leave a stray
// leading comma behind after the filler word is removed.
const FILLER_WORD_RE = /\b(um|uh|er|ah|like,?\s+you know|you know)\b,?/gi;
const WHITESPACE_RE = /\s+/g;
const SPACE_BEFORE_PUNCTUATION_RE = /\s+([,.!?])/g;

export function cleanTranscriptText(text: string): string {
  let cleaned = text.replace(FILLER_WORD_RE, ' ');
  cleaned = cleaned.replace(WHITESPACE_RE, ' ');
  cleaned = cleaned.replace(SPACE_BEFORE_PUNCTUATION_RE, '$1');
  return cleaned.trim();
}

// Matches "Dr. Pegram:" / "NEIL IYENGAR:" style speaker attribution at the
// start of a line.
const SPEAKER_LINE_RE = /(?:^|\n)([A-Z][a-zA-Z.\s]+):\s*/g;
const SPEAKER_NAME_RE = /^[A-Z][a-zA-Z.\s]+$/;

export function extractSpeakerSegments(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const parts = text.split(SPEAKER_LINE_RE);

  let currentSpeaker: string | null = null;
  for (const rawPart of parts) {
    const part = rawPart?.trim();
    if (!part) continue;

    if (SPEAKER_NAME_RE.test(part) && part.length < 50) {
      currentSpeaker = part;
    } else {
      segments.push({ speaker: currentSpeaker, text: cleanTranscriptText(part) });
    }
  }

  return segments;
}

/**
 * Split a combined prerecorded+livestream transcript at the Q&A boundary,
 * matching CPR-18's two priority template variants (pre-record + webinar
 * vs. webinar-only). Returns the full text unsplit if no clear boundary is
 * found, or if either resulting half is too short to be meaningful.
 */
const QA_MARKERS = [
  /Q\s*&\s*A/i,
  /questions?\s+from\s+the\s+audience/i,
  /live\s+discussion/i,
  /open\s+it\s+up\s+for\s+questions/i,
  /audience\s+questions/i,
];

export function splitPrerecordedLivestream(
  rawText: string,
): { prerecorded: string; livestream: string | null } {
  let earliestPos: number | null = null;
  for (const marker of QA_MARKERS) {
    const match = rawText.match(marker);
    if (match && match.index !== undefined) {
      if (earliestPos === null || match.index < earliestPos) {
        earliestPos = match.index;
      }
    }
  }

  if (earliestPos === null) {
    return { prerecorded: rawText, livestream: null };
  }

  const lineStart = rawText.lastIndexOf('\n', earliestPos);
  const splitPos = lineStart !== -1 ? lineStart + 1 : earliestPos;

  const prerecorded = rawText.slice(0, splitPos).trim();
  const livestream = rawText.slice(splitPos).trim();

  if (prerecorded.split(/\s+/).length < 50 || livestream.split(/\s+/).length < 50) {
    return { prerecorded: rawText, livestream: null };
  }

  return { prerecorded, livestream };
}

export function parseTranscriptText(rawText: string): ProcessedTranscript {
  const cleanedText = cleanTranscriptText(rawText);
  const segments = extractSpeakerSegments(rawText);
  return {
    rawText,
    segments,
    wordCount: cleanedText.split(/\s+/).filter(Boolean).length,
  };
}
