## ADDED Requirements

### Requirement: Public persisted-data API contract
`GET /api/digests/latest`, `GET /api/digests/[date]`, and `GET /api/stories/[id]` SHALL return sanitized persisted projections only. Missing resources and invalid public input SHALL return an HTTP error with `{ "error": { "code": "MACHINE_READABLE_CODE", "message": "Safe human-readable message" } }`.

#### Scenario: Requested story is missing
- **WHEN** a caller requests a story ID that does not exist
- **THEN** the endpoint returns HTTP 404 and the standard error object without internal diagnostics

### Requirement: Authenticated internal operations
`POST /api/internal/ingest/daily` and `POST /api/internal/stories/[id]/summaries/regenerate` SHALL require `INTERNAL_JOB_SECRET` and compare supplied credentials with a timing-safe comparison. Requests without a matching secret SHALL return HTTP 401 or HTTP 403 without invoking work.

#### Scenario: Internal secret does not match
- **WHEN** an internal regeneration request has a missing or mismatched secret
- **THEN** the endpoint rejects the request and no summary generation starts

### Requirement: Safe production diagnostics
Ingestion and server failures SHALL be logged as JSON records with correlation context, status, duration, and bounded metrics. Public responses SHALL NOT disclose stack traces, OpenAI errors, database URLs, secrets, job internals, or raw upstream failure data.

#### Scenario: Database query fails during public API handling
- **WHEN** the query layer raises an unexpected database error
- **THEN** the server logs structured diagnostics and returns a generic safe HTTP 500 error object
