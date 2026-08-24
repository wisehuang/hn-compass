# Tasks 4.1–4.4 — APIs and reader experience

## Tasks 5.1–5.3 — Delivery, documentation, and verification

- [x] Create the Railway-compatible Docker image, ignored build context, and non-secret environment template; prove the image builds and preserves the short-lived ingestion command.
- [x] Write operator documentation for local development, PostgreSQL migrations, seed/ingestion, recovery, and Railway Web/Cron deployment.
- [x] Exercise the production reader journey in Playwright from a seeded persisted-data projection, then run all quality gates.
- [x] Review scope, verification results, risks, and exact Railway deployment handoff.

## Review — Tasks 5.1–5.3

- `docker build --tag hn-compass:local-test .` passed; the image served the Web app on an injected `PORT`, and the ingestion command emitted a safe JSON failure then exited for an unavailable database.
- The Playwright journey visits `/`, opens the seeded story, and verifies both insight sections plus original and HN source links.
- `pnpm lint`, `pnpm test` (30 passed, 1 skipped optional database suite), `pnpm test:e2e` (1 passed), and `pnpm build` passed.
- Railway handoff documents the three persistent services, one-shot migration command, variables, `0 1 * * *` UTC schedule, retry, backup, rollback, and security boundaries.

- [x] 4.1 Add public API route contracts, safe error handling, and route tests.
- [x] 4.2 Add timing-safe internal route authentication, operations, diagnostics, and authorization tests.
- [x] 4.3 Add persisted-data RSC reading pages and seeded rendering tests.
- [x] 4.4 Add the JellyUI editorial interface, responsive/accessibility styling, and Playwright coverage.
- [x] Review the scoped diff and run lint, type-check, unit/integration, browser, and production-build verification.

## Review

- Route/authentication tests verify safe 404/500 envelopes, JSON-only diagnostics, and non-invocation on missing or mismatched secrets.
- Reader tests cover persisted projections, unavailable article material, provenance, comments, and external links; Playwright verifies labelled links, keyboard focus, and 320px layout.
- `pnpm test:e2e`, `pnpm test` (30 passed, 1 skipped database integration suite), `npx tsc --noEmit`, `pnpm lint`, and `pnpm build` passed.
- Spectra tasks 11–14 (4.1–4.4) marked complete; change progress is 14/17.

# Task 6 — Bounded Hacker News comment collection

- [x] Add failing traversal tests for ordering, sanitization, validity filtering, bounds, and concurrency.
- [x] Implement the Firebase comment collector with bounded traversal and typed output.
- [x] Run focused and project verification; record the review outcome.

## Review

- Focused traversal tests: 7 passed.
- Full Vitest suite: 12 passed, 1 skipped integration test.
- `pnpm lint`, `npx tsc --noEmit`, and `pnpm build` passed.
- Spectra task 6 (2.3) marked complete; change progress is 6/17.

# Task 7 — Explicit unavailable article material

- [x] Add failing tests for unavailable and too-short article persistence material.
- [x] Implement a typed article-material boundary that prevents article-summary input for unavailable material.
- [x] Run focused and project verification; record the review outcome.

## Review

- Focused article-material tests: 10 passed.
- Full Vitest suite: 18 passed, 1 skipped DB integration test.
- `pnpm lint`, `npx tsc --noEmit`, and `pnpm build` passed.
- Spectra task 7 (2.4) marked complete; change progress is 7/17.

# Tasks 8–10 — Validated AI summaries and daily ingestion

- [x] Add schema tests for validated summaries and comment-ID integrity.
- [x] Persist summary work separately from published summaries; implement bounded structured-output generation.
- [x] Implement the initial daily ingestion boundary and CLI lifecycle with independent story failures and run metrics.
- [x] Add orchestration integration tests for retryable failures, idempotent daily runs, and partial story failure.
- [x] Run migration, focused tests, lint, type-check, full tests, and production build; record review.

## Review

- Mock ingestion integration tests verify same-date idempotency and independent-story persistence after a story failure.
- Full Vitest suite: 24 passed, 1 skipped DB integration test.
- `pnpm lint`, `npx tsc --noEmit`, and `pnpm build` passed.
- Spectra tasks 8–10 (3.1–3.3) marked complete; change progress is 10/17.
