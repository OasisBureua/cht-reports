# Architecture

CHT Reports is an on-demand **SQS worker** on ECS Fargate (NestJS). The admin UI and JWT stay in `cht-platform-tool`. Warehouse data and ingest ETL stay in `cht-content-hub`. LLM calls go to `cht-companion` `POST /generate` (Claude Sonnet, no RAG).

```
  cht-platform-tool (JWT)
       │
       │  PutItem DDB (queued) + SendMessage { reportId }
       ▼
  SQS  *-requests-generate  (+ DLQ)
       │
       ▼
  ECS cht-reports worker
       │  UpdateItem DDB in place
       │  GET Content Hub /campaigns/{id}/report-packet
       │  S3 templates/{type}/{semver}/
       │  companion /generate (Sonnet)
       │  HTML → PDF
       ▼
  S3 reports/{campaignId}/{reportId}/vN.pdf
       │
       ▼
  Lambda (ObjectCreated, prefix reports/, suffix .pdf) → SES
       │
       ▼
  Standard-IA after 7 days
```

cht-reports has **no public or private ALB**. HTTP is health only (`/health`), for the ECS task check.

## Content Hub packet

cht-reports does **not** query Aurora or cht-platform-tool. Generate-time data is:

`GET /api/admin/campaigns/{campaignId}/report-packet?windowStart=&windowEnd=&sources=`

Auth: `X-API-Key` (`CONTENTHUB_API_KEY`) + `X-Request-Id`. `CONTENTHUB_BASE_URL` may be origin, `/api/public`, or `/api/admin`; the client rewrites to the admin API.

Response (camelCase): campaign identity, `hubspotRawData`, windowed `platformSlices`, `sessions` / `surveyResponses` (empty until Hub warehouse ingest), `inputCompleteness` per source (`ok` | `missing` | `error`). Missing sources are notes, not 500s. Hub does not call vendors on this path.

## What this repo owns

- NestJS SQS consumer and orchestrator
- DynamoDB generation-state **updates** (CHT PutItem)
- Packet fetch from Content Hub `GET /api/admin/campaigns/{id}/report-packet`
- Generate-time transcript NLG cleaning (copy only)
- HTML/PDF render and S3 artifact upload
- S3 → SES notify Lambda

## What other repos own

See:

- [companion-generate-model.md](./companion-generate-model.md)
- `cht-content-hub/docs/engineering/reports-ingest-etl.md`
- `cht-platform-tool/docs/engineering/reports-generate-and-transcripts.md`

## Compute

- ECS Fargate joins the shared platform cluster / Service Connect namespace (`cht-reports`).
- Scale on SQS backlog, hard max on task count.
- Lambda `generator` is notify-only (S3 event). It does not generate reports.
- EventBridge scheduled generate is off unless explicitly enabled.

## Environments

| Name | Prefix | GitHub Environment |
|------|--------|--------------------|
| Dev | `cht-reports-dev` | `development` |
| Production | `cht-reports-prod` | `production` |

AWS region: `us-east-1`. Account: `233636046512`.
