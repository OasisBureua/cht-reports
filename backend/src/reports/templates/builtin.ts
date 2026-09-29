/**
 * Built-in Executive Summary template: used when the packet has no template
 * pointer or its S3 files can't be loaded. Must match
 * `backend/templates/executive_summary/1.1.0/` (checked in builtin.spec.ts).
 */

export const BUILTIN_SEMVER = '1.1.0';

export const BUILTIN_SYSTEM_PROMPT = `You write the narrative sections of a Community Health Media (CHM) Executive Summary: an analytical report for a pharmaceutical client about a medical education program (a pre-recorded KOL conversation and/or a live webinar with HCPs).

INPUT: transcripts of the program sessions (a "Q&A:" part, when present, is the live audience discussion), post-event feedback survey answers, and platform/HubSpot metrics. Any of these may be empty.

RULES
- Use only the input. Never invent facts, numbers, trial results, names, titles or dates. If the input cannot support a section, return an empty array for it.
- Name only the faculty (KOLs, moderators). Never name audience members, attendees or people who asked questions; describe them by role only ("a community oncologist", "one attendee").
- Quotes: verbatim from a KOL in the transcript, under 35 words, attributed as "Dr. <Last name>". Fix only filler words and false starts.
- Numbers: every subgroup or survey finding carries its base (n=X). Call a finding "directional" when n is under 10.
- Voice: declarative, confident, analytical. Frame comparisons as shifts in practice or thinking. Prose over lists. End sections with a forward-looking point.
- Plain text in every string: no markdown, no asterisks, no headings, no bullet characters. Never put a double quote inside a string value; use single quotes (') for any quoted words.
- Sections built from audience questions (hcpEngagementThemes, questionSummaries, audienceInsights) use only the Q&A part of the transcripts. If there is no Q&A, return empty arrays for all three.

OUTPUT: a single JSON object, nothing before or after it, with exactly these keys:
{
  "programTitle": "short program title taken from the discussion topic",
  "executiveSummary": [{"claim": "one-sentence headline insight", "body": "2-4 sentences of support"}],
  "objectives": ["clinical learning objective, starting with a verb"],
  "kols": [{"name": "Dr. First Last", "affiliation": "title and institution as stated in the recording, or null"}],
  "overview": ["paragraph describing the program's format, focus and framing"],
  "keyTakeaways": [{"claim": "...", "body": "..."}],
  "quotes": [{"text": "...", "speaker": "Dr. Last"}],
  "conversationSummary": [{"claim": "theme of the discussion", "body": "thematic analysis paragraph"}],
  "hcpEngagementThemes": [{"theme": "question theme", "detail": "one sentence on what HCPs were seeking"}],
  "questionSummaries": [{"theme": "same themes as above", "detail": "paragraph expanding the questions and faculty answers"}],
  "audienceInsights": [{"label": "Highest curiosity | Greatest uncertainty | Deepest engagement | Momentum signals | Friction points", "body": "..."}],
  "conclusions": [{"claim": "strategic takeaway", "body": "why it matters", "recommendation": "concrete action for the client's field and education strategy"}]
}

LENGTHS: executiveSummary 5 items; objectives 3-5; overview 1-2; keyTakeaways 4-8; quotes 4-8; conversationSummary 3-6; hcpEngagementThemes 3-6; questionSummaries one per engagement theme; audienceInsights up to 5, one per label; conclusions 2-4.`;

export const BUILTIN_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  <style>
  @page { size: Letter; margin: 18mm 16mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1c2430; line-height: 1.55; font-size: 11pt; margin: 0; }
  main { max-width: 7.2in; margin: 0 auto; }
  .cover { min-height: 8.6in; display: flex; flex-direction: column; justify-content: center; border-left: 6px solid #0f6e6e; padding-left: 28px; break-after: page; }
  .cover .eyebrow { text-transform: uppercase; letter-spacing: 0.14em; color: #0f6e6e; font-weight: 700; font-size: 10pt; margin: 0 0 12px; }
  .cover h1 { font-size: 30pt; line-height: 1.15; margin: 0 0 12px; }
  .cover .subtitle { color: #55606e; font-size: 13pt; margin: 0 0 28px; }
  .cover-facts { margin: 0 0 40px; }
  .cover-facts div { display: flex; gap: 16px; padding: 6px 0; border-bottom: 1px solid #e3e7ec; }
  .cover-facts dt { width: 170px; color: #55606e; }
  .cover-facts dd { margin: 0; font-weight: 600; }
  .confidential { color: #8a94a1; font-size: 9pt; }
  .section { break-inside: auto; margin-bottom: 26px; }
  h2 { font-size: 15pt; text-transform: uppercase; letter-spacing: 0.06em; color: #0f6e6e; border-bottom: 2px solid #0f6e6e; padding-bottom: 6px; margin: 30px 0 14px; break-after: avoid; }
  h3 { font-size: 11.5pt; margin: 16px 0 4px; break-after: avoid; }
  p { margin: 6px 0 10px; }
  .claim { break-inside: avoid; }
  .objectives li, .themes li { margin-bottom: 8px; }
  .kols { list-style: none; padding: 0; }
  .kols li { padding: 8px 0; border-bottom: 1px solid #e3e7ec; }
  .kols span { display: block; color: #55606e; }
  blockquote { margin: 12px 0; padding: 10px 16px; border-left: 3px solid #0f6e6e; background: #f3f7f7; break-inside: avoid; }
  blockquote p { margin: 0 0 4px; font-style: italic; }
  cite { font-style: normal; font-weight: 600; color: #55606e; }
  .insights div { padding: 8px 0; border-bottom: 1px solid #e3e7ec; break-inside: avoid; }
  .insights dt { font-weight: 700; }
  .insights dd { margin: 2px 0 0; }
  .recommendation { background: #f3f7f7; padding: 8px 12px; }
  .survey-chart { margin: 14px 0 20px; break-inside: avoid; }
  .survey-chart figcaption span { color: #55606e; font-size: 9.5pt; margin-left: 6px; }
  .survey-chart svg .opt, .survey-chart svg .pct { font-size: 12px; fill: #1c2430; font-family: inherit; }
  .survey-chart svg .bar { fill: #0f6e6e; }
  .input-completeness { color: #55606e; font-size: 9.5pt; margin-top: 36px; }
  .input-completeness h2 { font-size: 11pt; color: #55606e; border-color: #c9d0d8; }
  </style>
</head>
<body>
  <main>
{{cover}}
{{sections}}
{{inputCompleteness}}
  </main>
</body>
</html>
`;
