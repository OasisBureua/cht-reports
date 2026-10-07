# Report-generation tracing (cross-repo)

Share this with cht-platform-tool, cht-content-hub, and cht-companion. Goal: follow **one generate** from admin click to PDF without AWS X-Ray.

X-Ray / OpenTelemetry is **not** a v1 prod gate. Correlation IDs in logs and HTTP headers are.

## Spine ID: `reportId`

Platform creates the DynamoDB row and the SQS body `{ reportId, campaignId }`. That UUID is the only ID every repo must use.

| Place | Field |
|-------|--------|
| DDB `cht-{env}-report-state` | `report_id` |
| SQS `cht-{env}-report-requests` | body `reportId` |
| Worker logs / DDB status updates | `requestId` (same value) |
| S3 | `reports/{campaignId}/{reportId}/vN.pdf` |
| Platform report-ready call | path `/internal/reports/{reportId}/ready`, header `X-Request-Id` |
| Hub packet GET | header `X-Request-Id` |
| Companion `POST /generate` | header `X-Request-Id` (proposed) |

A second ID (Hub-minted UUID, companion `request_id`, SQS `MessageId`, Cognito `jti`) is fine **if logged next to `reportId`**. It must not replace it on outbound calls.

Admin JWT / `X-Request-Id` on cht-platform-tool HTTP is a **different hop** (browser → BFF). Platform should log that HTTP id **and** the `reportId` on enqueue so a UI timeout still joins to generate.

## Proposed hop

```
browser
  │  Platform JWT (+ optional X-Request-Id = httpRequestId)
  ▼
cht-platform-tool  POST /api/reports  (or regenerate)
  │  PutItem report_id=R, status=queued
  │  SendMessage { reportId: R, campaignId }
  │  log: httpRequestId, reportId=R, campaignId
  ▼
SQS  cht-{env}-report-requests
  ▼
cht-reports ECS worker
  │  log every stage with reportId=R
  │  GET Hub /api/campaigns/{id}/report-packet
  │     X-Request-Id: R
  │     X-Client: cht-reports
  │     Authorization: Bearer (M2M hub/reports.read)
  │  POST companion /generate
  │     X-Request-Id: R
  │     X-Client: cht-reports
  │     log companion response request_id as companionRequestId
  ▼
S3  reports/{campaignId}/R/vN.pdf
  ▼
POST Platform /api/internal/reports/R/ready
  │     X-Request-Id: R
  │     Authorization: Bearer (M2M platform/reports.notify)
  ▼
Platform SES email (once per version)
```

## Contract (small)

1. **`X-Request-Id`** on Hub packet and companion `/generate` **is `reportId`**. Same value on 401 retry.
2. **`X-Client`** stays (`cht-reports`, `cht-platform-tool`, …). Identifies caller, not the job.
3. Every log line on the generate path includes `reportId` (and `campaignId` when known). Prefer JSON: `{"reportId","campaignId","stage","msg"}`.
4. Companion may keep its own `request_id` in the JSON body. Echo `X-Request-Id` if easy; otherwise cht-reports logs both.

Do not mint a new UUID for Hub (current cht-reports behavior). That splits Hub logs from DDB/SQS.

## Current vs needed

### cht-reports (this repo)

| Today | Before prod |
|-------|-------------|
| Orchestrator logs `Request ${reportId} …` on skip / complete / fail | Same, plus **stage** lines (`pulling_data`, `generating`, `rendering`, `uploading`) already implied by DDB; mirror them in logs |
| Hub `X-Request-Id` = **new `randomUUID()` per fetch** | Pass **`reportId`**. Thread it from `orchestrator.handle` → `ContentHubClient.fetchReportPacket` |
| Companion: `X-Client` only; drops body `request_id` | Send `X-Request-Id: reportId`. Log `companionRequestId` from the JSON body |
| SQS `MessageId` not logged | Log `sqsMessageId` once per receive (redelivery vs new enqueue) |
| No request-scoped logger; poll / health lines have no id | Acceptable. Do not require Nest CLS for v1 |
| Notify Lambda: X-Ray `Active`; generate ECS: none | Leave it. Do not add an X-Ray sidecar for v1 |
| CloudWatch `/ecs/cht-{env}-reports` (dev 7d, prod 365d) | Keep. Insights query below |

### cht-platform-tool

| Today (expected) | Before prod |
|------------------|-------------|
| Owns `reportId`, PutItem, SQS | Confirm enqueue logs `reportId` + `campaignId` |
| Download streams PDF via task role | Log `reportId` on download / 404 / KMS deny |
| Regenerates: reset queued, then SQS | Same `reportId` on the new message; log `edit_attempts` |
| Browser → BFF request id | Log next to `reportId` on create/regenerate |

No change to the SQS body shape (`reportId` + `campaignId`). Optional: SQS message attribute `reportId` (duplicate of body) for console filtering.

### cht-content-hub

| Today (expected) | Before prod |
|------------------|-------------|
| Packet GET requires `X-Request-Id` | **Log it on every packet request** (access + app), with `campaignId` |
| Auth is Cognito M2M `hub/reports.read` (not X-API-Key) | Unrelated to tracing; keep as-is |
| Warehouse SQL behind packet | If a packet is slow/fails, error log must include `X-Request-Id` |

Hub does not need to persist `reportId`. Logging the header is enough.

### cht-companion

| Today | Before prod |
|-------|-------------|
| `POST /generate` returns `request_id` | Accept **`X-Request-Id`**; log it on `/generate` (and Bedrock call if you wrap it) |
| `X-BFF-Auth` + `X-Client` | Unchanged |
| Chat `/chat` | Out of scope. Do not couple chatbot tracing to reports |

If companion already has a request-id middleware, bind `X-Request-Id` when present instead of minting a new one for `/generate`.

## What is **not** required for v1 prod

- AWS X-Ray, ADOT, or a shared OpenTelemetry collector
- Joining ECS traces to the notify Lambda’s X-Ray traces
- W3C `traceparent` / `X-Amzn-Trace-Id` propagation
- A dedicated tracing ticket on Hub ingest (VTT Lambda, warehouse ETL)

Revisit X-Ray when the **platform** (Platform + Hub + companion) standardizes it. Reports should not be the first service to introduce a daemon.

## Pre-prod checklist

**Must (correlation works in CloudWatch)**

- [ ] **cht-reports:** Hub `X-Request-Id` = `reportId` (not `randomUUID()`)
- [ ] **cht-reports:** companion `X-Request-Id` = `reportId`; log companion `request_id`
- [ ] **cht-reports:** log SQS `MessageId` on receive
- [ ] **cht-content-hub:** packet handler logs `X-Request-Id` + `campaignId` on success and error
- [ ] **cht-companion:** `/generate` logs inbound `X-Request-Id`
- [ ] **cht-platform-tool:** create / regenerate / download logs include `reportId`
- [ ] **Smoke:** create a report, copy `reportId` from DDB or Platform UI, Insights-search all four log groups (below). You should see the same UUID on Platform enqueue, worker stages, Hub packet, companion generate, S3 key, notify.

**Should (debug hangs / duplicates)**

- [ ] Worker generation **deadline** under SQS visibility (today **900s**). Fail and redeliver rather than run past visibility (duplicate generate).
- [ ] Timeouts on Hub `fetch` and companion `fetch` (`AbortSignal`); log `reportId` on abort
- [ ] Platform enqueue log includes the HTTP request id **and** `reportId`

**Later (not a prod blocker)**

- Structured JSON logs everywhere
- X-Ray / OTel across ECS + Lambda
- Pass `traceparent` in addition to `X-Request-Id`

## How to search

Dev worker group: `/ecs/cht-dev-reports` (confirm exact prefix in Terraform). Hub / Platform / companion use their own `/ecs/...` groups.

CloudWatch Logs Insights (each group):

```
fields @timestamp, @message
| filter @message like /<reportId>/
| sort @timestamp asc
```

S3: `reports/<campaignId>/<reportId>/`. DynamoDB: get item `report_id = <reportId>`. SQS DLQ: body `reportId`.

If Hub has lines for that campaign but **no** matching UUID, cht-reports is still sending a random `X-Request-Id` — that is the first reports-repo fix.

## Owners

| Repo | Owner | Prod-blocking work |
|------|--------|-------------------|
| cht-reports | Uche | Pass `reportId` as `X-Request-Id`; log companion + SQS ids |
| cht-platform-tool | Platform | Confirm enqueue/download logs include `reportId` |
| cht-content-hub | Hub | Packet logs include `X-Request-Id` |
| cht-companion | Companion | `/generate` logs `X-Request-Id` |

cht-reports can ship the header change without waiting on the others; Hub/companion logging is what makes the UUID searchable on **their** side.