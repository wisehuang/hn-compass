## ADDED Requirements

### Requirement: Idempotent daily RSS snapshot ingestion
The ingestion command SHALL use the configured RSS URL, validate feed entries, derive the digest date in Asia/Taipei, and persist one digest snapshot per date. A repeated run for the same date SHALL update or reuse the existing snapshot without duplicating stories, ranks, comments, or summaries.

#### Scenario: Same date is ingested twice
- **WHEN** two completed ingestion commands target `2026-08-24`
- **THEN** the database contains one digest for that date and one story row for each unique digest rank and HN item ID

### Requirement: Canonical Hacker News identity extraction
The collector SHALL accept an HN discussion ID only from an HTTPS URL with host `news.ycombinator.com`, path `/item`, and a positive-integer `id` query parameter. It SHALL reject every other URL shape.

#### Scenario: Canonical discussion link
- **WHEN** the RSS entry contains `https://news.ycombinator.com/item?id=12345`
- **THEN** the persisted story HN item ID is `12345`

##### Example: invalid discussion URLs
| URL | Result |
| --- | --- |
| `https://news.ycombinator.com/item?id=0` | rejected |
| `http://news.ycombinator.com/item?id=12345` | rejected |
| `https://example.com/item?id=12345` | rejected |

### Requirement: Bounded and sanitized Hacker News collection
The collector SHALL fetch official Firebase item records with concurrency no greater than five. It SHALL retain at most 40 valid top-level comments and at most two valid direct replies for each retained top-level comment, preserve top-level position, and store comment IDs, parent IDs, authors, scores, plain-text bodies, and fetch timestamps. Deleted, dead, empty, and very short comments SHALL NOT enter the representative corpus.

#### Scenario: Comment tree exceeds collection bounds
- **WHEN** an item has more than 40 valid top-level comments and a retained comment has more than two valid direct replies
- **THEN** only the first 40 valid top-level comments and first two valid direct replies by source order are persisted

### Requirement: Partial failure persistence and run observability
The command SHALL create an ingestion run record before upstream work, emit JSON logs, persist run metrics and a safe error summary, and close all HTTP and database resources before process exit. A story-level article, comment, or summary failure SHALL NOT prevent independent stories from reaching terminal states.

#### Scenario: One article host times out
- **WHEN** one article request exceeds its timeout while other stories succeed
- **THEN** the timed-out story records its article failure status, successful stories persist, and the run records the failure metric
