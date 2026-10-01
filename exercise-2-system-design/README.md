# Exercise 2 — Distributed Document Search Platform

## Assumptions

TODO

## Capacity estimation

TODO: storage (10M docs × 2 MB), upload throughput (100 docs/s), search QPS (3,000 rps), index size.

## High-level architecture

TODO: diagram + component list and why each was chosen.

## API design

TODO

## Core data model

TODO

## Document storage and metadata storage

TODO

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
