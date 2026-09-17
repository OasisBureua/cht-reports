# Preprocessing

Transcript and doctor-name cleaning for the report generation pipeline
(CPR-19). Ported from the prior CHM MediaHub report pipeline
(`chm_report_automation/src.legacy-2026-04-27/preprocessing.py` and
`models.py`), rewritten from Python to TypeScript for this service.

## What's here

- `kol-name.ts`: doctor name normalization (`Dr. Dr. Smith` becomes
  `Dr. Smith`, idempotent). Small, self-contained, direct port.
- `transcript.ts`: filler-word cleaning, speaker-segment extraction, and
  prerecorded/livestream splitting for CPR-18's two priority template
  variants.

## Not ported yet

The prior pipeline's docx-table transcript parser (three known
speaker/timestamp cell formats) and multi-format file reader
(`.docx`/`.vtt`/`.srt` with encoding fallback) are not included here. They
were built against a specific set of manually uploaded transcript files
with a known shape. What `cht-reports` will actually receive from
`cht-platform-tool`'s export contract (CPR-13) is not settled. Add this
once the export contract's transcript format is locked.

Zoom's own transcripts are raw WebVTT with timestamp-cue scaffolding,
stored unprocessed in `cht-platform-tool`'s S3 bucket with no existing
parser. A VTT-cue-stripping step is needed before this text reaches the
cleaning functions above, once CPR-13 lands.

## Out of scope

No drug, trial, or medical-terminology normalization exists here. Raw
transcripts still contain garbled medical terms (for example "destiny
breast 11" for DESTINY-Breast11) after this preprocessing step. The
generation prompt relies on the LLM's own medical knowledge plus
instructions to stay faithful to the transcript, not deterministic
correction. Whether `cht-reports` needs a real medical-term lookup (for
example against PubMed or ClinicalTrials.gov) is an open design question.
