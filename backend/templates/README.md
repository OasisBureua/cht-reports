# Report templates (CPR-25)

Template bodies the worker loads at generate time. Content Hub's
`report_templates` row points at one version (`type`, `semver`, `s3_key`);
the report packet carries that pointer as `template`.

```
templates/{type}/{semver}/
  system-prompt.md   system prompt sent to companion /generate
  template.html      HTML skeleton; placeholders {{title}}, {{sections}}, {{inputCompleteness}}
```

- The dev deploy (backend lane) syncs `backend/templates/` to
  `s3://<reports bucket>/templates/`.
- Treat a published version as immutable. Change the template by adding a new
  semver directory, then create the matching Hub row
  (`POST /api/admin/templates` with `semver` + `s3Key`).
- If the pointer is missing or the files can't be read, the worker uses the
  built-in Executive Summary prompt/HTML (`src/reports/templates/builtin.ts`)
  and notes it in the report's input-completeness section.
- `1.0.0` must stay identical to the built-in version; a unit test checks this.
