# Preprocessing

Generate-time transcript and doctor-name cleaning (copy only). Ported from
the prior CHM MediaHub pipeline, rewritten in TypeScript.

Content Hub already ETL'd warehouse text (VTT cues stripped). This module
does filler-word cleaning, speaker segments, and pre-record/livestream
split before the companion `/generate` prompt. It does not query Aurora
or cht-platform-tool.

## What's here

- `kol-name.ts`: doctor name normalization (`Dr. Dr. Smith` → `Dr. Smith`).
- `transcript.ts`: filler-word cleaning, speaker-segment extraction, and
  prerecorded/livestream splitting.

## Out of scope

No drug/trial-name normalization. VTT cue stripping is Content Hub ingest.
