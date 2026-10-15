#!/usr/bin/env node
/**
 * Local generate loop: runs the worker's real orchestrator on a packet file,
 * with local stand-ins for Content Hub, S3, DynamoDB, SQS and companion.
 * Writes v1.model.txt, v1.json, v1.html and v1.pdf to <outDir>.
 *
 *   npm run build
 *   PUPPETEER_EXECUTABLE_PATH=/path/to/chrome \
 *     node scripts/local/generate.js <packet.json> <outDir> <templateDir> [--reply <model.txt>]
 *
 * Model call: without --reply it calls Bedrock the way companion's /generate
 * does (Converse, model BEDROCK_MODEL_ID, default us.anthropic.claude-sonnet-5,
 * maxTokens REPORT_MAX_OUTPUT_TOKENS) through the AWS CLI (AWS_CLI, default
 * `aws`), using your AWS credentials. With --reply it reuses a saved model
 * reply instead: no AWS, no cost.
 *
 * Use fictional packets only (scripts/local/fixtures/).
 */

const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const dist = resolve(__dirname, '../../dist/reports');
const { ReportGenerationOrchestrator } = require(join(dist, 'orchestrator'));
const { ReportDocService } = require(join(dist, 'render/report-doc.service'));
const { ChromiumPdfPrinter } = require(join(dist, 'render/chromium-pdf-printer'));

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-5';
const MAX_TOKENS = Number(process.env.REPORT_MAX_OUTPUT_TOKENS || 16000);
const STOP = { end_turn: 'complete', stop_sequence: 'complete', max_tokens: 'truncated' };

function bedrockGenerate({ systemPrompt, userContent, maxTokens }) {
  const dir = mkdtempSync(join(tmpdir(), 'cht-reports-'));
  try {
    const input = join(dir, 'input.json');
    writeFileSync(
      input,
      JSON.stringify({
        modelId: MODEL_ID,
        system: [{ text: systemPrompt }],
        messages: [{ role: 'user', content: [{ text: userContent }] }],
        inferenceConfig: { maxTokens: maxTokens ?? MAX_TOKENS },
      }),
    );
    const out = execFileSync(
      process.env.AWS_CLI || 'aws',
      ['bedrock-runtime', 'converse', '--cli-input-json', `file://${input}`, '--cli-read-timeout', '600', '--output', 'json'],
      { maxBuffer: 64 * 1024 * 1024 },
    );
    const res = JSON.parse(out.toString());
    const text = (res.output?.message?.content ?? []).map((b) => b.text ?? '').join('');
    return {
      text,
      finishReason: STOP[res.stopReason] ?? 'complete',
      tokensInput: res.usage?.inputTokens,
      tokensOutput: res.usage?.outputTokens,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const [packetPath, outDir, templateDir] = args;
  const replyAt = args.indexOf('--reply');
  const replyPath = replyAt === -1 ? null : args[replyAt + 1];
  if (!packetPath || !outDir || !templateDir) {
    console.error('usage: node scripts/local/generate.js <packet.json> <outDir> <templateDir> [--reply <model.txt>]');
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const packet = JSON.parse(readFileSync(packetPath, 'utf-8'));
  const template = {
    systemPrompt: readFileSync(join(templateDir, 'system-prompt.md'), 'utf-8').trim(),
    html: readFileSync(join(templateDir, 'template.html'), 'utf-8'),
  };
  const printer = new ChromiumPdfPrinter();
  const log = (...m) => console.log('  ', ...m);

  const companion = {
    async generate(req) {
      writeFileSync(join(outDir, 'prompt.user.txt'), req.userContent);
      if (replyPath) return { text: readFileSync(replyPath, 'utf-8'), finishReason: 'complete' };
      log(`calling Bedrock ${MODEL_ID}...`);
      return bedrockGenerate(req);
    },
  };
  const storage = {
    async saveModelReply(_c, _r, version, text) {
      writeFileSync(join(outDir, `v${version}.model.txt`), text);
    },
    async uploadReport(_c, _r, version, html, content) {
      writeFileSync(join(outDir, `v${version}.html`), html);
      writeFileSync(join(outDir, `v${version}.json`), JSON.stringify(content, null, 2));
      writeFileSync(join(outDir, `v${version}.pdf`), await printer.print(html));
      return join(outDir, `v${version}.pdf`);
    },
  };
  const state = {
    async get() {
      return { status: 'pending', campaignId: packet.campaignId, editAttempts: 0, windowStart: null, windowEnd: null };
    },
    async initialize() {
      return this.get();
    },
    async beginAttempt(_id, status) {
      log(status);
    },
    async markStatus(_id, status) {
      log(status);
    },
    async markComplete(_id, key) {
      log(`complete: ${key}`);
    },
    async markFailed(_id, reason) {
      log(`FAILED: ${reason}`);
    },
    async markWaiting() {
      log('waiting for transcript');
    },
  };
  const orchestrator = new ReportGenerationOrchestrator(
    { fetchReportPacket: async () => packet },
    companion,
    new ReportDocService(),
    storage,
    { notify: async () => log('notify skipped (local)') },
    state,
    { load: async () => ({ template, note: null }) },
    { requeue: async () => { throw new Error('requeue not supported locally'); } },
    { transcriptRecentHours: 0, transcriptWaitMaxMinutes: 180, transcriptRecheckSeconds: 300, reportMaxOutputTokens: MAX_TOKENS },
  );
  await orchestrator.handle({ requestId: 'local', campaignId: String(packet.campaignId) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
