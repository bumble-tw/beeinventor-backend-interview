# Exercise 2 — Distributed Document Search Platform

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
- **Deletion is a soft delete.** The document disappears for users immediately, its search data is removed shortly after, and the original file and metadata are permanently removed after 30 days. The owner can restore it during those 30 days.
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
| **`index-worker`, `delete-worker`** (EKS) | Process queued jobs: build and remove search data | Scale on queue depth with KEDA, down to a small baseline when idle |
| **CronJobs** (EKS) | Every 5 minutes, expire abandoned uploads. Daily, permanently remove documents deleted more than 30 days ago: every S3 version (deleted by version ID) and the metadata | Simple scheduled work next to the rest of our code |
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
- **Delete:** `api` marks the document deleted in PostgreSQL (hidden at once) and queues a delete job → `delete-worker` removes its passages from OpenSearch → after 30 days a CronJob deletes every S3 version and the metadata.

Each path is described in detail in the sections below.

## API design

TODO

## Core data model

TODO

## Document storage and metadata storage

Each kind of data lives where it fits best. PostgreSQL and S3 are the source of truth; OpenSearch is a copy built for search.

| Store | What it holds | Role |
|---|---|---|
| **S3** | Original files at `docs/{docId}/v{n}` | Source of truth for content. Versioning is on, so the worker records the exact version it processed and downloads always serve that version. A lifecycle rule removes unfinished multipart uploads after 1 day. Replaced versions (from a retried upload) are kept, because downloads serve the version the worker processed. Permanent deletion removes every version by version ID, so a delete marker never leaves the file behind. |
| **Aurora PostgreSQL** | Documents (owner, title, status, version, S3 key and version, timestamps), sharing grants, groups, group members, audit log | Source of truth for metadata and permissions. One primary plus two read replicas across three AZs. |
| **OpenSearch** | One record per passage: text, document ID, status, and the list of users and groups allowed to read it | A derived copy that can be rebuilt from S3 and PostgreSQL at any time. Accessed through an alias, so the index can be rebuilt and switched without downtime. |

**Why metadata is not stored as S3 object metadata:** the system needs conditional updates (a document moves through states such as uploading, processing and searchable, and two workers must never both win), queries (for example, "all uploads that expired"), unique constraints (to stop duplicate documents on retries) and joins (to resolve group permissions). Those need a relational database.

When the database and the search index disagree, the database wins. How the two are kept in sync is covered in [Search indexing and DB ↔ search engine consistency](#search-indexing-and-db--search-engine-consistency).

## Upload and asynchronous processing pipeline

TODO

## Message queue, retries, idempotency, and dead-letter handling

TODO

## Search indexing and DB ↔ search engine consistency

TODO

## Authorization and permission filtering

TODO

## Scaling services, workers, and search infrastructure

TODO

## Deployment (containers and Kubernetes)

TODO

## Observability (logs, metrics, tracing, incident investigation)

TODO

## Discussion scenarios

### 1. Uploaded successfully but not searchable after 30 minutes

TODO

### 2. A worker crashes while processing a document

TODO

### 3. The same queue message is delivered more than once

TODO

### 4. A document is deleted while it is still being indexed

TODO

### 5. Search traffic suddenly increases 10×

TODO

## Trade-offs and alternatives considered

TODO
