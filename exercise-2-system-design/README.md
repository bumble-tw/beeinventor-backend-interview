# Exercise 2 — Distributed Document Search Platform

A design for a platform where users upload, view, search and delete text documents, sized for 1 million users, 10 million documents and 3,000 searches per second. This is a design document with diagrams; there is no code.

**In one paragraph:** files go straight from the browser to S3; S3 then queues a job, and workers split each document into small passages and index them in OpenSearch. PostgreSQL holds every document's status and permissions and is always the source of truth, so a search result is re-checked against it before a user sees it. Every background step can safely run twice, which is how retries and crashes are handled.

**Diagrams** appear as images in this page. Each one also has an interactive HTML version; GitHub shows HTML files as source, so download the file and open it in a browser to use it.

## Contents

- **Foundations:** [Assumptions](#assumptions) · [Capacity estimation](#capacity-estimation) · [High-level architecture](#high-level-architecture)
- **Data and APIs:** [API design](#api-design) · [Core data model](#core-data-model) · [Document storage and metadata storage](#document-storage-and-metadata-storage)
- **How data flows:** [Upload and asynchronous processing](#upload-and-asynchronous-processing-pipeline) · [Message queue, retries and DLQ](#message-queue-retries-idempotency-and-dead-letter-handling) · [Indexing and consistency](#search-indexing-and-db--search-engine-consistency) · [Authorization](#authorization-and-permission-filtering)
- **Running it:** [Scaling](#scaling-services-workers-and-search-infrastructure) · [Deployment](#deployment-containers-and-kubernetes) · [Observability](#observability-logs-metrics-tracing-incident-investigation)
- **Answers:** [Discussion scenarios](#discussion-scenarios) · [Trade-offs and alternatives](#trade-offs-and-alternatives-considered)

## Assumptions

The brief gives the scale and the requirements. Everything below is an assumption I added to make the design concrete.

- **Authentication** is handled by an external identity provider (for example Amazon Cognito). The API only validates the JWT and reads the user ID.
- **Access model:** every document has one owner. The owner can share it read-only with individual users or with groups. A user can belong to many groups; a typical user is in a few to a few dozen.
- **Documents are plain text (UTF-8).** Supporting PDF or other formats would add a text-extraction step to the worker; nothing else changes.
- **Maximum file size is 20 MB**, ten times the 2 MB average. A long novel in plain text is only a few MB.
- **Documents are indexed in passages of about 2 KB** (about 680 Chinese characters or 300–350 English words), with about 100 characters of overlap between neighbours so a phrase is not cut in half.
- **Search is keyword search**, not semantic search.
- **Capacity is planned for 2× today's volume** (20 million documents), because some choices, such as the number of search shards, are hard to change later.
- **The peak rates in the brief are peaks.** Average traffic is much lower.
- **There is no review or moderation step.** A processed document becomes searchable right away for the people allowed to read it.
- **Deletion has no undo.** The document disappears for users immediately, its search data is removed within seconds, and the original file (every S3 version) and its metadata are permanently removed by the next daily purge, so within about a day. An audit record of the deletion is kept. Restoring deleted documents is not a requirement, so it is not offered.
- **One AWS region, three Availability Zones.** Multi-region is out of scope.

## Capacity estimation

Order-of-magnitude numbers. Inputs from the brief: 1M users, 10M documents, 2 MB average, 100 uploads/s and 3,000 searches/s at peak, search under 500 ms, searchable within 5 minutes. For estimates, 1 KB ≈ 1,000 bytes; a Chinese character is 3 bytes in UTF-8.

### Results

| Component | Today | At 2× |
|---|---|---|
| S3 (original files) | ~20 TB | ~40 TB |
| PostgreSQL (metadata) | < 50 GB; 1 primary + 2 read replicas | < 100 GB |
| OpenSearch passages | ~10 billion | ~20 billion |
| OpenSearch disk (3 copies + free space) | ~100 TB | ~200 TB |
| OpenSearch primary shards | 1,000 (~25 GB each) | 1,000 (~50 GB each) |
| OpenSearch data nodes | ~40, plus 3 dedicated masters | ~80 |
| Worker pods at peak | ~40 | |
| API pods at peak | ~20 | |

### How the numbers are derived

**Storage**

```
Original files    10M docs × 2 MB                          = 20 TB
Passages per doc  2 MB ÷ 2 KB                              ≈ 1,000
Passages          10M × 1,000                              = 10 billion (+~15% for overlap)
```

**PostgreSQL**

```
documents         10M rows × ~1 KB                         ≈ 10 GB
document_grants   10M docs × ~3 grants × ~100 B            ≈ 3 GB
group_members     1M users × ~10 groups × ~100 B           ≈ 1 GB
Writes at peak    100 uploads/s × ~5 writes                ≈ 500/s    → primary
Reads at peak     3,000 searches/s × 2 queries             ≈ 6,000/s  → read replicas
```

**OpenSearch**

```
Stored text (_source)        20 TB, compressed to roughly half           ≈ 10 TB    (estimate)
Inverted index               same order as the text                      ≈ 10–15 TB (estimate)
Per-passage fields           10 billion × ~200 B                         ≈ 2 TB
Primary data                                                             ≈ 25 TB
3 copies (1 primary + 2 replicas, one per AZ)                            ≈ 75 TB
Keep disks ≤ ~75% full (allocation watermark, segment merges)            ≈ 100 TB
Primary shards   2× growth: 50 TB ÷ 50 GB per shard                      = 1,000
Data nodes       100 TB ÷ ~2.5 TB usable per node                        ≈ 40
Indexing at peak 100 docs/s × 1,000 passages                             = 100,000 passages/s (~200 MB/s of text)
```

**Workers and API**

```
Workers   100 docs/s × ~2 s per doc = 200 docs in flight ÷ 10 per pod = 20 pods → ~40 with headroom
API       3,000 searches/s ÷ ~300 per pod                    = 10 pods → ~20 with headroom
```

### Time budgets

| Search (500 ms) | Budget |
|---|---|
| Load balancer + API | ~20 ms |
| Look up the user's groups | ~5 ms |
| OpenSearch query | ≤ 300 ms |
| Re-check permissions in PostgreSQL | ~10 ms |
| Spare | ~165 ms |

| Upload to searchable (5 min) | Budget |
|---|---|
| S3 event → queue | seconds |
| Waiting in the queue | < 1 min |
| Processing | seconds |
| OpenSearch refresh | ≤ 30 s |
| **Typical total** | **about 1 min**, under 2 min even when the queue backs up; alert when the oldest message waits more than 3 min |

### The bottleneck is search, not storage

A document can be shared with anyone, so the passages a user may read are spread across all shards, and every search has to ask every shard:

```
3,000 searches/s × 1,000 shards = 3 million shard queries/s
```

This is why shards are sized large (fewer shards per search), and why the replica count follows query load, not storage. The ~40 data nodes is a starting point; the final count comes from the load test below.

### What is estimated, and how to confirm it

The OpenSearch size and the cost of one shard query depend heavily on Chinese text analysis and compression. The worker time per document and the requests one API pod can serve are also estimates. I would confirm them by indexing about 10,000 real books, measuring index size and per-shard query latency, and load-testing the API, then scaling the numbers up.

## High-level architecture

[![High-level architecture](diagrams/high-level-architecture.png)](diagrams/high-level-architecture.html)

Interactive version (open locally in a browser): [`diagrams/high-level-architecture.html`](diagrams/high-level-architecture.html). Source: [`diagrams/high-level-architecture.json`](diagrams/high-level-architecture.json).

**The split:** our own stateless code runs on Kubernetes (Amazon EKS); anything that stores data is an AWS managed service. A pod that misbehaves can simply be replaced, while backups, replication and failover of the data stores are handled by AWS.

### Components

| Component | What it does | Why this choice |
|---|---|---|
| **ALB + AWS WAF** | Entry point: TLS, load balancing, basic bot and rate rules | Managed load balancer that EKS can configure directly (AWS Load Balancer Controller) |
| **`api`** (EKS) | Authorization, search, sharing, signing upload/download links, and deletion (marks the document deleted and queues a delete job) | Stateless, so it scales out on CPU with HPA |
| **`index-worker`, `delete-worker`** (EKS) | Process queued jobs: `index-worker` builds search data and rewrites permissions on passages; `delete-worker` removes search data | Scale on queue depth with KEDA, down to a small baseline when idle |
| **CronJobs** (EKS) | Every 5 minutes, expire abandoned uploads and count stuck documents for alerting. Daily, permanently remove deleted documents (once their search data is cleared), and expired or failed documents older than 7 days: every S3 version (deleted by version ID) and the metadata | Simple scheduled work next to the rest of our code |
| **S3** | Original files | Durable and cheap; pre-signed URLs let browsers upload and download directly, so file traffic never passes through the API; emits an event when a file arrives |
| **Aurora PostgreSQL** | Metadata, permissions, document status | Transactions and conditional updates for the document state machine; read replicas for permission checks |
| **SQS Standard + DLQ** | Processing jobs | Retries and a dead-letter queue are built in; workers are idempotent, so the queue does not need to guarantee order or exactly-once delivery |
| **OpenSearch Service** | Passage index: keyword search, permission filter, highlighted passages | Full-text search with filtering and highlighting at this scale, managed across three AZs |
| **ElastiCache Redis** | Rate limits, short-lived search cache, recent permission changes | Fast state shared by all API pods |
| **CloudWatch + X-Ray** (via OpenTelemetry / ADOT) | Logs, metrics, traces, alerts | AWS-native; OpenTelemetry keeps the code independent of the monitoring vendor |

### Not tied to AWS

The design relies on capabilities, not on AWS-specific features. Any platform that offers these can run it with the matching services:

| Capability needed | AWS | Example alternatives |
|---|---|---|
| Object storage with pre-signed URLs and "object created" events | S3 | Google Cloud Storage, Azure Blob Storage |
| Relational database with transactions | Aurora PostgreSQL | Cloud SQL, Azure Database for PostgreSQL |
| At-least-once queue with retries and a dead-letter queue | SQS | Pub/Sub, Azure Service Bus, RabbitMQ |
| Search engine with filters and highlighting | OpenSearch Service | Elasticsearch (Elastic Cloud) |
| Managed Kubernetes | EKS | GKE, AKS |

### Request paths

- **Search:** browser → ALB → `api` → rate limit (Redis) → OpenSearch (keywords + permission filter) → `api` re-checks permissions in PostgreSQL → results with highlighted passages.
- **Upload:** browser → `api` creates the document record and returns a pre-signed upload link → browser uploads straight to S3 → S3 event → SQS.
- **Background processing:** SQS → `index-worker` → reads the file from S3 → writes passages to OpenSearch → marks the document searchable in PostgreSQL.
- **Delete:** `api` marks the document deleted in PostgreSQL (hidden at once) and queues a delete job → `delete-worker` removes its passages from OpenSearch → the next daily purge deletes every S3 version and the metadata.

Each path is described in detail in the sections below.

## API design

REST + JSON under `/v1`. Users sign in with an external identity provider; every request carries `Authorization: Bearer <JWT>`, and the API only validates the token and reads the user ID. IDs are ULIDs (sortable, and they do not reveal how many documents exist).

### Endpoints

| Method and path | What it does | Who can call it |
|---|---|---|
| `POST /v1/documents` | Create a document and get a pre-signed upload link | Any signed-in user |
| `GET /v1/documents?scope=owned\|shared&cursor=` | List my documents, or documents shared with me | Any signed-in user |
| `GET /v1/documents/{docId}` | Document details and status | Owner, viewers |
| `GET /v1/documents/{docId}/download` | Get a short-lived download link | Owner, viewers |
| `DELETE /v1/documents/{docId}` | Delete: hidden at once, permanently removed within about a day | Owner |
| `GET /v1/documents/{docId}/grants` | List who the document is shared with | Owner |
| `PUT /v1/documents/{docId}/grants/{user\|group}/{id}` | Share with a user or a group (read-only) | Owner |
| `DELETE /v1/documents/{docId}/grants/{user\|group}/{id}` | Stop sharing | Owner |
| `POST /v1/groups`, `GET /v1/groups` | Create a group; list my groups | Any signed-in user |
| `PUT` / `DELETE /v1/groups/{groupId}/members/{userId}` | Add or remove a member | Group admin |
| `GET /v1/search?q=&page=&pageSize=` | Keyword search over documents I can read | Any signed-in user |

### Create a document

```http
POST /v1/documents
Authorization: Bearer <JWT>
Idempotency-Key: 01J9ZQ…            (generated by the client, reused on retry)

{ "title": "Quantum Mechanics", "filename": "quantum.txt", "sizeBytes": 2097152, "contentType": "text/plain" }
```

```json
201 Created
{
  "docId": "01J9ZK…",
  "status": "UPLOADING",
  "upload": {
    "url": "https://<bucket>.s3.amazonaws.com/",
    "fields": { "key": "docs/01J9ZK…/v1", "policy": "…", "x-amz-signature": "…" },
    "expiresAt": "2026-10-07T08:15:00Z"
  }
}
```

A retry with the same `Idempotency-Key` returns the same `docId` instead of creating a second document.

### Search

```json
GET /v1/search?q=quantum&page=1&pageSize=10

200 OK
{
  "results": [
    {
      "docId": "01J9ZK…",
      "title": "Quantum Mechanics",
      "passages": [ { "chunkNo": 7, "highlight": "<em>Quantum</em> mechanics studies very small particles…" } ]
    }
  ],
  "page": 1,
  "pageSize": 10,
  "approxTotal": 128
}
```

Each document appears once, with up to 3 matching passages.

### Rules for every endpoint

| Rule | Why |
|---|---|
| Errors look like `{"error": {"code", "message", "requestId"}}`; `requestId` is the trace ID | A user can quote it, and we find the full trace in one lookup |
| **No permission returns `404`, not `403`** | `403` would confirm that the document exists |
| `413` when the declared size is over 20 MB | The upload link would reject it anyway; fail early |
| `429` with `Retry-After` when rate limited | Clients know when to retry |
| `POST /v1/documents` requires `Idempotency-Key`; `PUT` and `DELETE` are idempotent by design | Retries never create duplicates |
| Lists use a cursor; search uses pages (max 20 per page, max 100 pages) | Lists come from PostgreSQL, where a cursor is stable; search is ranked by relevance in OpenSearch |
| Highlights are HTML-escaped before the `<em>` tags are added | Document text is user content and could contain script tags |

## Core data model

### Document states

```
POST /documents
      │
      ▼
  UPLOADING ── deadline passed, no file in S3 (cleanup job)  ──▶ EXPIRED
            └─ file arrived > 10 min after deadline (worker) ──▶ EXPIRED
      │ S3 event
      ▼
  PROCESSING ── content check failed ──▶ FAILED
      │
      ▼
  SEARCHABLE

  UPLOADING / PROCESSING / SEARCHABLE / FAILED ── DELETE ──▶ DELETED ── daily purge ──▶ permanently removed
  EXPIRED / FAILED ── daily purge, after 7 days ──▶ permanently removed
```

Every state change is a conditional update, for example `UPDATE documents SET status = 'PROCESSING' WHERE id = $1 AND status = 'UPLOADING'`. When two workers race, exactly one update succeeds; the other sees zero rows changed and stops. The one exception is taking over from a crashed worker, described in the upload pipeline.

### PostgreSQL (source of truth)

```sql
users           (id PK, email UNIQUE, display_name, created_at)
groups          (id PK, name, created_by, created_at)
group_members   (group_id, user_id, role,                        -- role: 'admin' | 'member'
                 PRIMARY KEY (group_id, user_id))                 -- a user can be in many groups

documents       (id PK, owner_id, title, original_filename, size_bytes,
                 status,                                          -- the state machine above
                 acl_version,                                     -- bumped on every sharing change
                 s3_key, s3_version_id,                           -- the exact file version processed
                 claimed_at,                                      -- when a worker claimed it (crash takeover)
                 search_cleared_at,                               -- set by delete-worker; purge waits for it
                 idempotency_key, UNIQUE (owner_id, idempotency_key),
                 upload_expires_at, uploaded_at, searchable_at, deleted_at,
                 failed_reason, created_at, updated_at)

document_grants (doc_id, principal_type, principal_id, permission, -- 'user' | 'group';  'owner' | 'viewer'
                 PRIMARY KEY (doc_id, principal_type, principal_id))

audit_log       (id PK, actor_id, action, doc_id, created_at)     -- deletes, purges, sharing changes
outbox          (id PK, doc_id, action, trace_context, created_at, sent_at)  -- messages waiting to be sent to SQS
```

Main indexes: `documents (owner_id, created_at)` for "my documents", `document_grants (principal_type, principal_id)` for "shared with me", `group_members (user_id)` to look up a user's groups, and partial indexes on `UPLOADING` and `DELETED` rows for the scheduled jobs.

### OpenSearch passage index (derived copy)

One record per passage of about 2 KB:

| Field | Type | Purpose |
|---|---|---|
| `_id` | `{docId}-{chunkNo}` | Fixed ID, so writing the same passage twice overwrites it |
| `docId`, `chunkNo` | keyword / integer | Group results by document |
| `acl_version` | long | Permission version: a permission update skips passages that already have newer permissions |
| `title`, `text` | text, Chinese-aware analyzer | Keyword search and highlighting |
| `acl` | keyword list, e.g. `["user:12", "group:7"]` | Who may read this passage (see [Authorization](#authorization-and-permission-filtering)) |

The application reads and writes through an alias, so the index can be rebuilt under a new name and switched over without downtime.

## Document storage and metadata storage

Each kind of data lives where it fits best. PostgreSQL and S3 are the source of truth; OpenSearch is a copy built for search.

| Store | What it holds | Role |
|---|---|---|
| **S3** | Original files at `docs/{docId}/v{n}` | Source of truth for content. Versioning is on, so the worker records the exact version it processed and downloads always serve that version. A lifecycle rule removes unfinished multipart uploads after 1 day. Replaced versions (from a retried upload) are kept, because downloads serve the version the worker processed. Permanent deletion removes every version by version ID, so a delete marker never leaves the file behind. |
| **Aurora PostgreSQL** | Documents (owner, title, status, S3 key and version, timestamps), sharing grants, groups, group members, audit log | Source of truth for metadata and permissions. One primary plus two read replicas across three AZs. |
| **OpenSearch** | One record per passage: text, document ID, and the list of users and groups allowed to read it | A derived copy that can be rebuilt from S3 and PostgreSQL at any time. Accessed through an alias, so the index can be rebuilt and switched without downtime. |

**Why metadata is not stored as S3 object metadata:** the system needs conditional updates (a document moves through states such as uploading, processing and searchable, and two workers must never both win), queries (for example, "all uploads that expired"), unique constraints (to stop duplicate documents on retries) and joins (to resolve group permissions). Those need a relational database.

When the database and the search index disagree, the database wins. How the two are kept in sync is covered in [Search indexing and DB ↔ search engine consistency](#search-indexing-and-db--search-engine-consistency).

## Upload and asynchronous processing pipeline

[![Upload and background processing](diagrams/upload-processing.sequence.png)](diagrams/upload-processing.sequence.html)

Interactive version: [`diagrams/upload-processing.sequence.html`](diagrams/upload-processing.sequence.html) · source: [`diagrams/upload-processing.sequence.json`](diagrams/upload-processing.sequence.json)

### Steps

1. **Create the record.** The browser calls `POST /v1/documents`. The API checks the declared size (≤ 20 MB), inserts the document as `UPLOADING` with a 15-minute deadline, inserts the owner's grant, and returns a pre-signed **POST** link.
2. **Upload straight to S3.** The link's policy fixes the key (`docs/{docId}/v1`) and limits the size to 1 B–20 MB, so S3 itself rejects anything else. File bytes never pass through the API.
3. **S3 starts the processing.** When the file arrives, S3 sends an `ObjectCreated` event to SQS. Completion is taken from this event, not from the browser, so it still works if the user closes the tab.
4. **Claim the document.** A worker moves the document from `UPLOADING` to `PROCESSING` with a conditional update, and records which S3 version it is processing and when (`claimed_at`).
   - **Taking over after a crash:** if the document is already `PROCESSING` for the same S3 version and the claim is older than the queue's visibility timeout, the earlier worker crashed, so this worker takes over. If the claim is recent, another worker is still on it and this one stops. A worker busy with a large file refreshes `claimed_at` whenever it extends the visibility timeout, so it is never mistaken for a crashed one.
   - **Late files:** the 15-minute deadline is checked against when the file arrived in S3 (from the event), not when the worker runs. A file that arrived up to 10 minutes late is accepted, even if the queue was backed up.
5. **Check the content.** The worker reads the file from S3 and checks the real size and that it is UTF-8 text, since a pre-signed link can only check what the client declares.
6. **Split and index.** The text is split into passages of about 2 KB with about 100 characters of overlap, and written to OpenSearch with the bulk API.
7. **Mark searchable.** The document becomes `SEARCHABLE` and the worker deletes the queue message. Typically this takes about a minute after the upload finishes.

### When things go differently

| Situation | Who handles it | What happens |
|---|---|---|
| The user never uploads | Cleanup CronJob, every 5 minutes | A document still `UPLOADING` 10 minutes past its deadline becomes `EXPIRED`, but only after confirming that no file exists in S3; if one does, the job queues an `index` message for it instead. S3 sends no event when nothing arrives, so a scheduled check is needed. Unfinished multipart uploads are removed by an S3 lifecycle rule after 1 day. |
| The file arrives more than 10 minutes after the deadline | Worker | Judged by the arrival time in the event. The worker moves the document `UPLOADING → EXPIRED` (a conditional update); if the document is now `EXPIRED`, it deletes that file version from S3 using the version ID in the event, and the user is asked to upload again. In any other state the event is a retried upload: it is ignored and nothing is deleted. |
| The same link is used twice (a retried upload) | Worker | The second event carries a different S3 version from the one being processed, so the worker ignores it and deletes nothing. Downloads keep serving the version that was processed. |
| The content check fails | Worker | The document becomes `FAILED` with a reason, and the user is told why. |

## Message queue, retries, idempotency, and dead-letter handling

**SQS Standard with a dead-letter queue (DLQ).** Messages are small; the file stays in S3.

- **Index after an upload:** the S3 `ObjectCreated` event itself. The worker reads `docId` and the version from the key `docs/{docId}/v{n}`.
- **Everything else** is `{docId, action}`, for `delete` and `acl` (after a delete or a sharing change) and `index` (for a file the cleanup job found that was never processed). These go through an **outbox**: the message is inserted into an `outbox` table in the same transaction as the change, and a small relay loop sends unsent rows to SQS and marks them sent. If the API crashes right after committing, the message is still sent; if the relay sends a row twice, the idempotent workers make that harmless.

| Setting | Value | Why |
|---|---|---|
| Visibility timeout | Longer than the slowest document; the worker extends it while a large file is still being processed | A message being worked on must not reappear and be picked up by a second worker |
| Retries | Up to 5 receives (`maxReceiveCount`), then the message moves to the DLQ | A file that always fails stops wasting workers |
| DLQ | Alarm on any message; keep messages 14 days; after a fix, redrive them back to the main queue | A failure is noticed and can be replayed, instead of expiring silently |

If a worker crashes, it never deletes the message. The message reappears after the visibility timeout, and the next worker finds the document still `PROCESSING` for the same S3 version and finishes the job. A document that keeps failing ends up in the DLQ, which raises an alarm.

### Making retries safe

SQS Standard can deliver a message more than once, and a crash means some work is repeated. Every step is therefore idempotent: running it twice gives the same result as running it once.

| Technique | Effect |
|---|---|
| Re-read the document's status from PostgreSQL before acting | For a deleted document, the worker first deletes its passages by `docId` (harmless if there are none), then acknowledges the message. A worker that crashed after writing passages for a since-deleted document therefore leaves nothing behind |
| Fixed passage IDs (`{docId}-{chunkNo}`) | Writing a passage again overwrites it instead of adding a duplicate |
| A document's text never changes after upload (there is no edit) | A late or repeated write always writes the same text, so it cannot replace newer content |
| Set values, never increment (`status = 'SEARCHABLE'`, not `count = count + 1`) | Repeating a database write changes nothing |
| `Idempotency-Key` on `POST /v1/documents` | A retried request returns the same document instead of creating a new one |

Workers always read from the primary database, never a read replica, because a replica can lag behind the change that triggered the message. Replicas serve the API's reads, such as the search re-check.

Because ordering and duplicates are handled this way, the queue does not need to guarantee order or exactly-once delivery. Workers would need these checks with any queue anyway: no queue can promise that a message is processed exactly once.

## Search indexing and DB ↔ search engine consistency

**PostgreSQL is the source of truth; OpenSearch is a copy built for search.** The copy can lag behind, so anything that must be correct, such as status and permissions, is decided by the database. When the two disagree, the database wins. Passages therefore carry no `status` and no content version: status is decided by the database re-check, and a document's text never changes after upload.

### Freshness

Writes become searchable after an OpenSearch refresh. The refresh interval is about 30 seconds instead of the default 1 second, which allows much higher indexing throughput and still fits the 5-minute target: a document is typically searchable about a minute after its upload finishes.

### Deletion, step by step

| When | Who | What |
|---|---|---|
| Immediately | `api` | Marks the document `DELETED` (a conditional update) and queues a `delete` message. Searches stop returning it at once, because the database re-check before results are returned only keeps `SEARCHABLE` documents (see [Authorization](#authorization-and-permission-filtering)). Download requests are refused. |
| Seconds later | `delete-worker` | Deletes all of the document's passages from OpenSearch by `docId`, then records `search_cleared_at`. |
| If indexing was still running | `index-worker` | After writing, it re-reads `status` and `acl_version`. If the document was deleted meanwhile, it deletes the passages it just wrote; if sharing changed, it applies the new `acl` to them. |
| Next daily run, within about a day | Purge CronJob | For deleted documents whose `search_cleared_at` is set: deletes every S3 version by version ID, then the document's grants and row. An audit record remains. |

The document row stays until the purge, so a late message for this document still finds it `DELETED` and is handled as above. If an upload event arrives after the row is gone (the user deleted an unfinished upload and still finished uploading before the link expired), the worker deletes that S3 version from the event.

### Rebuilding the index

Because the copy can always be rebuilt from S3 and PostgreSQL, the index can be recreated at any time, for example to change the analyzer or the number of shards: build a new index, fill it from the source of truth, then switch the alias.

## Authorization and permission filtering

[![Search with permission filtering](diagrams/search-permissions.sequence.png)](diagrams/search-permissions.sequence.html)

Interactive version: [`diagrams/search-permissions.sequence.html`](diagrams/search-permissions.sequence.html) · source: [`diagrams/search-permissions.sequence.json`](diagrams/search-permissions.sequence.json)

### Model

Every document has one owner, who can share it read-only with users or groups. Permissions are stored as typed principals, such as `user:12` or `group:7`, in `document_grants`. Only two functions decide access:

- `principals(user)` returns the user's identity list: `user:12` plus one `group:<id>` for every group they belong to.
- `authorize(user, action, doc)` checks a single action (view, download, delete, share) against PostgreSQL.

### Filtering search results

Each passage in OpenSearch carries an `acl` list with everyone allowed to read it, for example `["user:12", "group:7"]`. Groups are stored as group IDs, not expanded into members, so adding someone to a group changes only `group_members` and no search data.

1. The API builds the identity list from PostgreSQL.
2. OpenSearch runs the keyword query with the list as a `terms` filter on `acl`. As a filter it does not affect ranking and can be cached, and because it runs inside the query, pagination stays correct.
3. Before returning a page, the API re-checks those 10–20 documents in PostgreSQL, joining `group_members` directly, and keeps only documents that are still `SEARCHABLE` and still readable by the user. This also hides a document the moment it is deleted, before its passages are removed.

OpenSearch provides speed; PostgreSQL provides correctness.

### Revoking access

Any sharing change (share or stop sharing) updates `document_grants` and increments `documents.acl_version` in one transaction; `api` then queues an `acl` message. `index-worker` reads the current grants from the primary database and rewrites `acl` on the document's passages (about 1,000), skipping passages that already carry a newer `acl_version`, so an older, slower update can never overwrite a newer one. An indexing run that overlaps a sharing change re-reads `acl_version` after writing and applies the new `acl`, so no passage keeps old permissions. This usually takes seconds, and up to about a minute.

- **Stop sharing:** until the passages are rewritten, the re-check in step 3 removes the document, so the user never sees it.
- **Share:** the new reader can search the document once the passages are rewritten, usually within a minute. Opening it by link works at once, because `authorize()` reads PostgreSQL.

Read replicas can lag behind the primary by a fraction of a second. For about 10 seconds after a document's sharing changes, or after a user is removed from a group, the re-check reads from the primary instead (Redis remembers what changed recently). If Redis is unavailable, every re-check goes to the primary: slower, but never wrong.

### Other safeguards

- No permission returns `404`, so a document ID reveals nothing.
- Under heavy load, search results may be cached briefly. The cache holds only raw OpenSearch hits, keyed by query and identity list, and the re-check in step 3 always runs on them, so a cached result can never bring back a deleted or unshared document.
- Download links expire in 5 minutes. A link that was already issued cannot be revoked; that short window is accepted.
- The identity list goes into a single `terms` filter, which OpenSearch limits to 65,536 values by default. Typical users belong to a few to a few dozen groups; far beyond that, a dedicated authorization service would be needed.

### Adding more permission types later

New kinds of access are new principal types, without changing the architecture: `org:5` for "everyone in the organization", `public` for public documents, `role:reviewer` plus a `PENDING_REVIEW` status for a review step. Only `principals()`, `authorize()` and the values written into `acl` change.

## Scaling services, workers, and search infrastructure

### Everyday scaling

| Layer | How it scales | Based on | How long it takes |
|---|---|---|---|
| `api` pods | HPA (min 10, max 100) | CPU | 1–3 minutes |
| `index-worker`, `delete-worker` pods | KEDA | SQS queue depth | 1–3 minutes |
| EKS nodes | Karpenter adds EC2 nodes when pods do not fit | Pending pods | 1–2 minutes more |
| Aurora read replicas | Aurora Auto Scaling | CPU, connections | About 10 minutes |
| OpenSearch | Planned from load tests and alarms; data nodes added manually or on a schedule | CPU, search queue, JVM memory | Tens of minutes for nodes; hours for an extra replica (each shard is copied) |

OpenSearch is the bottleneck (every search asks every shard, see [Capacity estimation](#capacity-estimation)) and also the slowest layer to grow. Its storage and shards are planned for 2× today's data, and its replicas are sized by load test to handle about **2× the search peak** (6,000 searches/s is the load-test target, not a measured number). Sizing it for 10× would leave most of it idle; known busy periods are scaled ahead of time instead.

### When search traffic jumps

A sudden spike arrives faster than OpenSearch can grow, so the rule is **protect first, then scale**. Protections are applied in this order, cheapest first:

| Step | What happens | What is given up |
|---|---|---|
| 1. Give indexing's capacity to search | Lower the worker limit and lengthen the OpenSearch refresh interval | Freshness: new uploads may take longer than 5 minutes to appear, but they all arrive |
| 2. Cache popular queries | Keep raw OpenSearch hits for 30–60 seconds, keyed by query and identity list; the permission re-check still runs on every request | Results can be up to a minute old |
| 3. Lighter queries | One highlighted passage per document instead of three; return partial results when a time limit is hit | Some search quality |
| 4. Per-user rate limit | A token bucket in Redis; AWS WAF blocks obvious bots | Very heavy users get `429` |
| 5. Global limit | Cap concurrent OpenSearch queries; reject the rest with `429` and `Retry-After` | Some users wait, but everyone else stays fast |

**The permission re-check is never skipped**, at any step. Step 5 matters because without it OpenSearch's own queue fills up and every request times out together.

Meanwhile, the API scales out in minutes, Aurora adds replicas in about ten, and OpenSearch nodes follow. When traffic falls, the protections are removed in reverse order.

**First, find out where the traffic comes from:** real users (caching helps most), a scraper (rate limits and WAF), or our own bug such as a client retry loop (fix it and rate-limit meanwhile).

## Deployment (containers and Kubernetes)

[![Deployment on EKS](diagrams/eks-deployment.png)](diagrams/eks-deployment.html)

Interactive version: [`diagrams/eks-deployment.html`](diagrams/eks-deployment.html) · source: [`diagrams/eks-deployment.json`](diagrams/eks-deployment.json)

Only our own stateless code and a few cluster add-ons (Argo CD, Karpenter, the log and telemetry agents) run on Kubernetes; everything that stores data is an AWS managed service. The diagram leaves the data stores out on purpose; they are shown in the [High-level architecture](#high-level-architecture).

| Workload | Kubernetes object | Scaling |
|---|---|---|
| `api` | Deployment behind the ALB | HPA |
| `index-worker`, `delete-worker` | Deployments, no inbound traffic | KEDA |
| Cleanup (every 5 minutes), purge (daily) | CronJobs, never two runs at once | — |
| Fluent Bit (logs), ADOT collector (metrics and traces) | DaemonSets, one per node | Grows with the nodes |

Nodes are EC2 instances in private subnets, spread across three Availability Zones and managed by Karpenter.

### What keeps it running

| Concern | What we do | Why |
|---|---|---|
| **Health checks** | *Readiness* decides whether a pod gets traffic (checks the pod has started and its database connections are ready). *Liveness* decides whether to restart it (checks only the process itself). Neither checks OpenSearch; a slow OpenSearch is handled inside search requests by the degradation steps in [Scaling](#scaling-services-workers-and-search-infrastructure). | If a probe depended on OpenSearch or the database, one slow dependency would pull every pod out of service at once (readiness) or restart them all (liveness), and uploads and downloads would fail along with search. |
| **Rolling updates** | New pods start and pass readiness before old ones stop (`maxUnavailable: 0`). Images are tagged with the commit SHA. Database changes are made in two steps: first add (old and new code both work), later remove. | No drop in capacity during a deploy; a bad version stops rolling out on its own and can be rolled back; old and new pods run side by side during the rollout. |
| **Graceful shutdown** | `api` leaves the load balancer, then finishes in-flight requests. A worker stops taking new messages and finishes its current document; if it is cut off, it never deleted the message, so another worker takes over (see [Message queue](#message-queue-retries-idempotency-and-dead-letter-handling)). | Deploys and scale-downs lose no work. |
| **Spread and maintenance** | Pods are spread evenly across the three AZs; a PodDisruptionBudget keeps at least 80% of `api` running while nodes are replaced. Every pod sets CPU and memory requests and limits. | One AZ failing leaves two thirds of capacity; maintenance never takes everything down at once. |
| **Permissions and secrets** | EKS Pod Identity gives each workload its own IAM role with only what it needs (for example, `api` can sign links under `docs/*` but cannot write to OpenSearch). Database passwords come from AWS Secrets Manager. Containers run as non-root. | No AWS keys in code or images; a compromised pod can do little. |

### Shipping a change

```
git push → CI runs tests and builds the image (tag = commit SHA) → push to ECR
        → update the manifest → Argo CD syncs the cluster → rolling update
Rollback: revert the commit; Argo CD syncs the previous version.
```

## Observability (logs, metrics, tracing, incident investigation)

The code uses **OpenTelemetry**, and the AWS Distro for OpenTelemetry (ADOT) collector sends metrics to CloudWatch and traces to X-Ray. Logs are JSON lines written to stdout; Fluent Bit ships them to CloudWatch Logs, so logs survive even if the collector is down. Because the code depends only on OpenTelemetry, changing the monitoring vendor means changing collector settings, not code.

### Logs

Every log line carries `traceId`, `docId` (when there is one), `userId` and an `event` name such as `index.started` or `index.failed`, so one search by `docId` shows everything that happened to a document. Logs never contain document text, pre-signed links or secrets.

### Metrics and alerts

Alerts follow the two targets from the brief: search under 500 ms, and searchable within 5 minutes of upload. Freshness is measured per document as `searchable_at − uploaded_at`. Thresholds below are starting values, tuned after load tests.

| Area | Alert when | Why it matters |
|---|---|---|
| Search | p99 latency > 500 ms for 5 minutes; 5xx > 1% | The search target is missed |
| Freshness | 95th percentile > 3 minutes, or any document > 5 minutes | The 5-minute target is at risk before users notice |
| Queue | Oldest SQS message older than 3 minutes | Workers are falling behind |
| DLQ | Any message | A document is failing repeatedly |
| Stuck documents | Any document still `UPLOADING` 10 minutes past its deadline with a file in S3, or `PROCESSING` far longer than the visibility timeout (counted by the cleanup job) | These never get a `searchable_at`, so the freshness metric alone cannot see them |
| OpenSearch | Cluster status red; rejected requests; JVM memory > 85%; free disk < 25% | The search layer is overloaded or running out of space |
| Aurora | Read replica lag > 1 second | Re-checks read the primary only for 10 seconds after a change; lag near that window would let a re-check read stale grants |
| Purge | A deleted document still present more than 2 days later | Deletion is not completing |

Alerts that threaten a target (search latency, freshness, DLQ, OpenSearch red) page the on-call engineer; the rest open a ticket.

### Traces

HTTP calls, PostgreSQL queries, AWS SDK calls and OpenSearch requests are traced automatically. SQS does not carry trace context on its own. For messages we send (through the outbox), the trace context is stored in the `outbox` row and sent as the W3C `traceparent` message attribute, so the worker continues the same trace. Upload events are sent by S3, which cannot carry our trace, so the worker starts a new trace and logs it with the `docId`; searching logs by `docId` joins the upload request and the processing trace. Normal requests are sampled at about 5–10%; errors and slow requests are always kept.

### Dashboards

1. **Search:** traffic, latency, errors, `429`s, whether degraded mode is on.
2. **Upload pipeline:** freshness, documents per state, stuck documents, processing time.
3. **Queue:** queue depth, oldest message, DLQ.
4. **OpenSearch:** cluster health, CPU, JVM memory, rejections, disk.

## Discussion scenarios

### 1. Uploaded successfully but not searchable after 30 minutes

The stuck-document alert should already have fired; if a user noticed first, that alert is fixed afterwards. First, **one document or many?** For one document, search the logs by `docId` and check its status:

- `UPLOADING`: the S3 event never reached the queue; the cleanup job finds the file and queues it.
- `PROCESSING`: a worker is stuck, or the message is in the DLQ.
- `FAILED`: the reason is recorded.
- `SEARCHABLE`: check the search side (passages present, user's permission, how the query was analyzed).

For many documents, check queue age, worker limits and OpenSearch rejections. See [Observability](#observability-logs-metrics-tracing-incident-investigation) and [Upload pipeline](#upload-and-asynchronous-processing-pipeline).

### 2. A worker crashes while processing a document

The worker never deleted the message, so it reappears after the visibility timeout. The next worker sees the document still `PROCESSING` for the same S3 version, with a claim older than the timeout, and takes over. Passages have fixed IDs, so rewriting them creates no duplicates. A document that keeps failing ends in the DLQ and raises an alarm. See [Upload pipeline](#upload-and-asynchronous-processing-pipeline) step 4 and [Message queue](#message-queue-retries-idempotency-and-dead-letter-handling).

### 3. The same queue message is delivered more than once

Every step is idempotent: the worker re-reads the document's status first, passages have fixed IDs, database writes set values instead of incrementing, and a second event for an already-processed upload is ignored. Processing a message twice gives the same result as once. See [Message queue](#message-queue-retries-idempotency-and-dead-letter-handling).

### 4. A document is deleted while it is still being indexed

The user stops seeing it at once, because the permission re-check before results are returned keeps only `SEARCHABLE` documents. `delete-worker` removes the passages. If `index-worker` writes passages after that, it re-reads the status when it finishes and deletes what it wrote; and if it crashes first, the retried message finds the document `DELETED` and deletes its passages before acknowledging. The daily purge then removes every S3 version and the row. See [Deletion, step by step](#deletion-step-by-step).

### 5. Search traffic suddenly increases 10×

Protect first, then scale: OpenSearch takes tens of minutes to grow, so the system degrades in a fixed order (freshness, then cached hits, then lighter queries, then per-user and global limits), while the API, Aurora and OpenSearch scale out behind it. The permission re-check is never skipped. Find out whether the traffic is real users, a scraper or our own bug, because each needs a different fix. See [Scaling](#scaling-services-workers-and-search-infrastructure).

## Trade-offs and alternatives considered

| Decision | Chosen | Alternatives | Why |
|---|---|---|---|
| Platform | AWS managed services; our code on EKS | Vendor-neutral design; self-hosting everything on Kubernetes | Concrete services make failure handling concrete, and managed data stores give multi-AZ without running them ourselves. |
| Processing queue | SQS Standard + DLQ | SQS FIFO; Kafka | Workers must be idempotent with any queue, so ordering and de-duplication add nothing, while retries and a DLQ come built in. |
| Index unit | One record per ~2 KB passage | One record per document | Results must show matching passages with highlights in under 500 ms, which is cheap on short passages and slow on 2 MB books. |
| Search engine | OpenSearch Service | PostgreSQL full-text search; Elasticsearch | 20 TB and 3,000 searches/s rule out PostgreSQL; OpenSearch and Elasticsearch are close, and OpenSearch is the AWS-managed option. |
| Permission filtering | `acl` on every passage, plus a database re-check before returning | Filtering after the search; updating `acl` synchronously | Filtering inside the query keeps pages correct, and the re-check makes stale `acl` values harmless. |
| Upload path | Pre-signed POST straight to S3 | Uploading through the API | 200 MB/s of file traffic never touches the API, and S3 enforces the size limit. |
| Message delivery | Transactional outbox | Sending to SQS right after the commit | A crash between commit and send can no longer lose a delete or a sharing change. |
| Deletion | Hidden at once, permanently removed within about a day, no restore | Soft delete with a 30-day restore window | The brief asks for deletion, not restore, and a restore path added race conditions for no stated need. |
| Availability Zones | Three | Two | OpenSearch master elections need a majority, which two zones cannot keep after losing one. |
| Capacity headroom | Shards sized for 2× today | Size for today; size for 10× | The shard count cannot be changed in place, and 10× would leave most of the cluster idle. |
| Instrumentation | OpenTelemetry → CloudWatch and X-Ray | A vendor's own agent | The code stays the same if the monitoring vendor changes. |
