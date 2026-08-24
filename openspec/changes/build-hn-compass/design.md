## Context

HN Compass starts from an empty repository and publishes a daily, persisted Hacker News digest for Traditional Chinese technical readers. The source list is Daemonology HN Daily RSS; article URLs and Hacker News content are untrusted. Railway supplies a private PostgreSQL service, a public Next.js web service, and a second service that runs the same image as a short-lived Cron command. Railway evaluates Cron schedules in UTC, so 09:00 Asia/Taipei is `0 1 * * *`.

## Goals / Non-Goals

**Goals:**

- Serve fast public pages and read APIs exclusively from persisted PostgreSQL snapshots.
- Produce concise Traditional Chinese summaries with provenance, source links, and clear AI disclosure.
- Make daily ingestion idempotent, safe against SSRF, bounded in time and concurrency, and diagnosable after partial failures.
- Use Next.js App Router, strict TypeScript, RSC by default, Tailwind CSS, JellyUI Web Components, Drizzle, Zod, OpenAI Responses structured output, Vitest, Playwright, Docker, and Railway.

**Non-Goals:**

- User accounts, subscriptions, payments, reader comments, voting, live updates, full HN comment-tree rendering, vector search, a separate backend service, LINE integration, or fetching private, authenticated, and paywalled content.

## Decisions

### Persist snapshots before serving readers

`digests`, `stories`, `comments`, `summaries`, and `ingestion_runs` form the authoritative read model. A unique digest date, unique `(digest_id, rank)`, unique `hn_item_id` per story, and unique `(story_id, hn_comment_id)` make re-runs safe. Summaries use JSONB and retain model, prompt version, input hash, and generation time. Public GET routes and RSC pages use query services only; upstream network calls and OpenAI invocations exist only in ingestion or a secret-protected regeneration route.

Alternative: fetch upstream sources during reader requests. Rejected because it raises latency, costs, availability risk, and prompt-injection exposure on public traffic.

### Use one behavior-rich ingestion boundary

`src/server/ingestion` owns RSS parsing, canonical HN ID extraction, safe article fetching, Firebase traversal, sanitization, retries, bounded concurrency, summary generation, and run metrics. It directly persists results through Drizzle repositories; it does not add forwarding-only adapters. `src/server/queries` owns stable projections for pages and public APIs.

Alternative: split every provider into independently layered adapters. Rejected because this MVP needs a single testable orchestration boundary rather than extra pass-through modules.

### Enforce explicit upstream safety and limits

Article fetches accept only `http:` and `https:`, resolve and reject loopback, private, link-local, multicast, unspecified, and other non-routable destinations, follow at most three redirects with validation on every hop, timeout after ten seconds, and read at most 2 MiB. The extractor converts safe HTML to text before model input. The collector fetches at most 40 valid top-level HN comments and at most two valid direct replies per retained top-level comment, with concurrency five. OpenAI calls run with concurrency two; every upstream class retries transient failures at most three times with exponential backoff.

Alternative: unrestricted generic URL fetching and recursive HN traversal. Rejected because it exposes internal networks, makes cost and duration unbounded, and stores unnecessary material.

### Treat unavailable material as an explicit state

When article content is unavailable, too short, unsafe, or exceeds limits, the story remains visible with its original links and HN discussion. The article summary is absent and the reader sees a clear unavailable-content disclosure; the model does not infer an article summary from a title or RSS fragment. Deleted, dead, empty, and very short comments are excluded, while collected comments are sanitized to plain text and preserve HN identity and linkage.

### Use structured, validated AI output

Article and discussion prompts delimit all RSS, article, and comment material as quoted untrusted source text. Responses must conform to separate Zod schemas that match the product JSON shapes; malformed output is recorded as failed summary work and never published. Discussion viewpoint comment IDs must refer only to persisted comment IDs; consensus is null for sparse or mixed evidence.

Alternative: free-form model text parsed heuristically. Rejected because it breaks reliable rendering, provenance, and safe retry behavior.

### Use JellyUI for the editorial interface

The app loads JellyUI as its official dependency-free Web Components module and wraps the interface with `jelly-theme mode="auto"`. JellyUI tokens and primitives establish dark/light mode, contrast, focus, buttons, badges, and disclosure treatments; Tailwind handles layout and a small HN-orange editorial token layer. Semantic landmarks, heading order, external-link labels, and visible keyboard focus are required.

### Use minimal internal authentication and safe errors

Internal POST routes compare `INTERNAL_JOB_SECRET` with timing-safe equality and return no diagnostic details to unauthenticated callers. Public route errors follow `{ "error": { "code": string, "message": string } }`; server logs retain structured diagnostics without secrets, database URLs, stack traces, raw upstream failures, or OpenAI responses in public output.

## Implementation Contract

**Behavior and interfaces:**

- `npm run ingest:daily` determines the Asia/Taipei digest date, creates an `ingestion_runs` record, ingests the configured RSS feed, persists all successful independent work, reports metrics in JSON logs, releases database and HTTP resources, and returns zero only when the run reaches its defined terminal success state.
- The read model contains `digests`, `stories`, `comments`, `summaries`, and `ingestion_runs` with the required fields, JSONB payloads, relationships, uniqueness constraints, and lookup indexes described in the product requirements.
- `GET /api/digests/latest`, `GET /api/digests/[date]`, and `GET /api/stories/[id]` return persisted, sanitized projection data. Missing data returns the standard safe error object and HTTP 404.
- `POST /api/internal/ingest/daily` and `POST /api/internal/stories/[id]/summaries/regenerate` require the internal secret and reject missing or mismatched credentials without exposing operational detail.
- `/`, `/daily/[date]`, and `/stories/[storyId]` render persisted data, empty/error/not-found states, source links, summary provenance, representative comments, and AI-disclosure copy without raw upstream HTML.
- A Docker image runs the web service on Railway's `PORT`; the second Railway service uses the same image and `npm run ingest:daily` with UTC schedule `0 1 * * *`.

**Failure behavior:** unsafe URLs, malformed RSS/API data, unavailable articles, invalid AI payloads, and individual comment failures are persisted as bounded story-level failures and do not erase other stories. A failed ingestion run records a safe error summary and metrics. Public callers never receive secrets or raw upstream diagnostic data.

**Acceptance criteria:** Vitest covers RSS parsing, canonical ID extraction, HTML sanitization, bounded traversal, SSRF redirect checks, idempotency, schema validation, query projections, and endpoint authorization. Playwright seeds one digest, opens the home page and detail page, sees both summaries, and sees both external source links. Lint, unit tests, E2E tests, and production build pass.

**Scope boundaries:** this contract covers the stated MVP and its three Railway services. It excludes reader identity, live updates, subscription delivery, write interactions, private-source retrieval, and any non-Next.js backend.

## Risks / Trade-offs

- [RSS content is late or malformed] → Persist the latest completed snapshot, validate feed entries with Zod, retry transient feed failures, and log a safe run metric.
- [Article hosts block extraction] → Do not bypass restrictions; persist an unavailable status and preserve original links and discussion coverage.
- [Model cost or latency grows] → Hash inputs, avoid public-request generation, limit concurrency, persist outputs, and regenerate only through protected operations.
- [Railway skips overlapping Cron executions] → Bound all network work, close pools, record run duration, and use idempotent digest keys.
- [A model invents consensus or citations] → Require Zod validation, enforce persisted representative IDs, use null consensus for insufficient evidence, and disclose AI limitations.
- [JellyUI custom elements load after first paint] → Use semantic HTML fallbacks and load the official module at application layout scope.

## Migration Plan

1. Provision Railway PostgreSQL privately and set service variables.
2. Apply Drizzle migrations before the first ingestion deployment.
3. Deploy the Web service with health checking when configured by Railway.
4. Deploy the same image as a Cron service with start command `npm run ingest:daily` and schedule `0 1 * * *`.
5. Verify one seeded or manual ingestion run, public read routes, logs, and run metrics.
6. Roll back application image on regressions; retain database snapshots and use a backward-compatible migration policy. Restore from Railway backup only for database data loss.

## Open Questions

None. Runtime limits, model name, source RSS URL, and secrets remain environment-configured except for safe upper bounds documented above.
