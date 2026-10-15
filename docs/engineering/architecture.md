# Architecture

CHT Reports is an on-demand **SQS worker** on ECS Fargate (NestJS). The admin UI and JWT stay in `cht-platform-tool`. Warehouse data and ingest ETL stay in `cht-content-hub`. LLM calls go to `cht-companion` `POST /generate` (Claude Sonnet, no RAG).

```
  cht-platform-tool (JWT)
       │
       │  PutItem DDB (queued) + SendMessage { reportId }
       ▼
  SQS  cht-{env}-report-requests  (+ _dlq)
       │
       ▼
  ECS cht-reports worker
       │  UpdateItem DDB in place
       │  GET Content Hub /campaigns/{id}/report-packet
       │  S3 templates/{type}/{semver}/
       │  companion /generate (Sonnet)
       │  HTML → PDF
       ▼
  S3 reports/{campaignId}/{reportId}/vN.pdf   (Standard-IA after 30 days)
       │  UpdateItem DDB complete (s3_key_pdf, version)
       ▼
  POST cht-platform-tool /api/internal/reports/{reportId}/ready
       │  Bearer M2M platform/reports.notify
       ▼
  Platform emails notify_emails via SES (once per version)
```

### Report versions (CPR-35)

Each report row keeps every version: `v1` is the first report, and each
Regenerate writes the next one (`v2`, `v3`, ...). The worker takes the
number from Platform's `edit_attempts` (version = edit_attempts + 1), so a
retried attempt rewrites the same version instead of skipping one. Each
version has its own `.pdf`, `.html`, `.json` and `.model.txt`. On complete
the worker writes `s3_key_pdf` and `version`, which Platform shows and
downloads.

### Waiting for the Zoom transcript (CPR-47)

If a session from the last 24 hours (`TRANSCRIPT_WAIT_RECENT_HOURS`) has no transcript yet, the job goes to `waiting_for_transcript` and re-queues itself with a delay (`TRANSCRIPT_RECHECK_SECONDS`, default 300). Waiting does not use up an attempt. After `TRANSCRIPT_WAIT_MAX_MINUTES` (default 180) the job fails with the reason. Reports built from transcripts note that they are machine-generated.

### Report-ready email (CPR-35)

Platform sends it, like its other transactional email (same sender, layout
and recipients from the row's `notify_emails`). After marking the job
complete, the worker calls `POST {PLATFORM_BASE_URL}/internal/reports/{id}/ready`
with `{ campaignId, version }`. Platform records the emailed version on the
row, so retries do not double-send. A failed generate never reaches this
call. A failed call is logged and retried, never fails the report.

cht-reports has **no public or private ALB**. HTTP is health only (`/health`), for the ECS task check.

## Content Hub packet

cht-reports does **not** query Aurora or cht-platform-tool. Generate-time data is:

`GET /api/campaigns/{campaignId}/report-packet?windowStart=&windowEnd=&sources=`

Auth: `X-API-Key` (`CONTENTHUB_API_KEY`) + `X-Request-Id`. `CONTENTHUB_BASE_URL` may be origin, `/api/public`, or `/api/admin`; the client rewrites to the admin API.

Response (camelCase): campaign identity, `hubspotRawData`, windowed `platformSlices`, `sessions` / `surveyResponses` (empty until Hub warehouse ingest), `inputCompleteness` per source (`ok` | `missing` | `error`). Missing sources are notes, not 500s. Hub does not call vendors on this path.

Fields the report reads beyond those (CPR-46; each is optional until Hub sends it):

| Field | Used for |
|---|---|
| `kols[]` `{ name, title, institution }` | Key Opinion Leaders section and cover. Overrides the KOLs the model reads from the transcript; the report notes when it falls back to the transcript. |
| `registeredCount`, `attendedCount`, `avgMinutesWatched`, `attendees[]` `{ specialty, institution, minutesWatched }` | Attendees section (CPR-42). Counts only; no names. |
| `surveyQuestions[]` `{ id, prompt, type, options, surveyType }` | Survey chart labels and option order (CPR-43). Answers are matched on `id`. |

For Zoom sessions with no audience Q&A, the three Q&A sections are replaced by one note that live Q&A capture is not available yet (CPR-33).

## What this repo owns

- NestJS SQS consumer and orchestrator
- DynamoDB generation-state **updates** (CHT PutItem)
- Packet fetch from Content Hub `GET /api/campaigns/{id}/report-packet`
- Generate-time transcript NLG cleaning (copy only)
- HTML/PDF render and versioned S3 artifact upload
- Telling Platform a report version is ready (Platform sends the email)

## What other repos own

See:

- [companion-generate-model.md](./companion-generate-model.md)
- `cht-content-hub/docs/engineering/reports-ingest-etl.md`
- `cht-platform-tool/docs/engineering/reports-generate-and-transcripts.md`

## Compute

- ECS Fargate joins the shared platform cluster / Service Connect namespace (`cht-reports`).
- Scale on SQS backlog, hard max on task count.
- Lambda `generator` is an unused scaffold (it does not generate or notify). Removal touches CI, alarms and rollback, so it is tracked separately.
- EventBridge scheduled generate is off unless explicitly enabled.

## Environments

| Name | Prefix | GitHub Environment |
|------|--------|--------------------|
| Dev | `cht-reports-dev` | `development` |
| Production | `cht-reports-prod` | `production` |

AWS region: `us-east-1`. Account: `233636046512`.
