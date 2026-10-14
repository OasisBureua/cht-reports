# Local report loop

Render and generate reports on your machine with the worker's own code. Use
fictional data only (`fixtures/`).

Setup, once:

```
npx @puppeteer/browsers install chrome-headless-shell@stable --path ~/.cache/cht-reports-chrome
export PUPPETEER_EXECUTABLE_PATH=<path to the chrome-headless-shell binary it prints>
```

Build without touching the tracked `tsconfig.build.tsbuildinfo`:

```
rm -rf dist && npx tsc -p tsconfig.build.json --incremental false
```

| Script | What it does | AWS |
|---|---|---|
| `render.js <content.json> <outDir> [templateDir]` | Content JSON (a report's `v{N}.json`) to HTML + PDF | none |
| `generate.js <packet.json> <outDir> <templateDir> [--reply model.txt]` | Runs the real orchestrator on a packet: prompt, model, parse, render, PDF. `--reply` reuses a saved model reply | Bedrock (your credentials), unless `--reply` |
| `check-layout.js <report.html>` | Per-slide fill and overflow; exits 1 if any slide overflows | none |
| `template-src/build.js <fontsDir> templates/executive_summary/<semver>` | Builds `template.html` (embeds Chillax and the CHM logo) and regenerates `src/reports/templates/builtin.ts` | none |

`generate.js` calls Bedrock the way companion's `/generate` does (Converse,
`us.anthropic.claude-sonnet-5`, `REPORT_MAX_OUTPUT_TOKENS`). About $0.10 per run.

Chillax font files (Fontshare, ITF Free Font License):
`https://api.fontshare.com/v2/css?f[]=chillax@400,500,600` lists the woff2 URLs;
save them as `chillax-400.woff2`, `chillax-500.woff2`, `chillax-600.woff2`.
