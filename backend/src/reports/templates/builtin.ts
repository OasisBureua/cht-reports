/**
 * Built-in Executive Summary template: used when the packet has no template
 * pointer or its S3 files can't be loaded. Must match
 * `backend/templates/executive_summary/1.0.0/` (checked in builtin.spec.ts).
 */

export const BUILTIN_SYSTEM_PROMPT = `You are generating an Executive Summary report for a CHM medical education campaign. Use only the transcript, survey, platform metric, and HubSpot data provided. Do not invent data not present in the input.`;

export const BUILTIN_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{title}}</title>
  <style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; }
  h1 { font-size: 28px; margin-bottom: 32px; }
  h2 { font-size: 20px; margin-top: 40px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  p { font-size: 16px; margin: 16px 0; }
  .input-completeness p { color: #555; }
  </style>
</head>
<body>
  <main>
    <h1>{{title}}</h1>
{{sections}}
{{inputCompleteness}}
  </main>
</body>
</html>
`;
