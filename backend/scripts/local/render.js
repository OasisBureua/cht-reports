#!/usr/bin/env node
/**
 * Local render loop: report content JSON -> HTML + PDF, with the worker's own
 * renderer and printer. No AWS, no Hub, no model call.
 *
 *   npm run build
 *   PUPPETEER_EXECUTABLE_PATH=/path/to/chrome \
 *     node scripts/local/render.js <content.json> <outDir> [templateDir]
 *
 * content.json is a report's v{N}.json (ExecutiveSummaryContent), e.g. from
 * scripts/local/generate.js or a dev report's artifacts. templateDir is a
 * backend/templates/executive_summary/<semver> folder; omit it for the
 * built-in template.
 */

const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, resolve } = require('node:path');

const dist = resolve(__dirname, '../../dist/reports');
const { ReportDocService } = require(join(dist, 'render/report-doc.service'));
const { ChromiumPdfPrinter } = require(join(dist, 'render/chromium-pdf-printer'));

async function main() {
  const [contentPath, outDir, templateDir] = process.argv.slice(2);
  if (!contentPath || !outDir) {
    console.error('usage: node scripts/local/render.js <content.json> <outDir> [templateDir]');
    process.exit(2);
  }
  const content = JSON.parse(readFileSync(contentPath, 'utf-8'));
  const htmlTemplate = templateDir ? readFileSync(join(templateDir, 'template.html'), 'utf-8') : undefined;

  const html = await new ReportDocService().renderExecutiveSummary(content, { htmlTemplate });
  const pdf = await new ChromiumPdfPrinter().print(html);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.html'), html);
  writeFileSync(join(outDir, 'report.pdf'), pdf);
  console.log(`wrote ${join(outDir, 'report.html')} and report.pdf (${pdf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
