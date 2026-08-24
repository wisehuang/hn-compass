## 1. Foundation and persisted data

- [x] 1.1 Bootstrap the strict TypeScript Next.js App Router project, Tailwind CSS, JellyUI module loading, package scripts, Vitest, and Playwright so `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` are defined; verify each command reaches its configured runner without missing-script errors.
- [x] 1.2 Implement **Persist snapshots before serving readers** with Drizzle schema, migrations, indexes, and typed repositories for digests, stories, comments, summaries, and ingestion runs; verify a migration against PostgreSQL creates required constraints including unique digest date, digest rank, HN item, and story comment identity.
- [x] 1.3 Implement public query projections so **Public persisted-data API contract** returns sanitized data from PostgreSQL only; verify query-service integration tests cover latest digest, date lookup, story lookup, and missing-resource results.

## 2. Safe upstream collection

- [x] 2.1 Implement **Canonical Hacker News identity extraction** and RSS parsing with Zod validation so only canonical HTTPS `news.ycombinator.com/item?id=<positive integer>` links yield an HN item ID; verify Vitest accepts `id=12345` and rejects the three documented invalid URL examples.
- [x] 2.2 Implement **Safe article acquisition** and **Enforce explicit upstream safety and limits** so URL scheme/IP screening, three-hop redirect revalidation, ten-second timeout, 2 MiB body cap, and HTML-to-text sanitization occur before extraction; verify SSRF and redirect-validation tests reject loopback and private redirect targets.
- [x] 2.3 Implement **Bounded and sanitized Hacker News collection** against Firebase so it retains ordered valid top-level comments and direct replies within 40/2 limits and concurrency five; verify traversal tests exclude deleted, dead, empty, and short comments while preserving IDs, parent IDs, positions, and plain text.
- [x] 2.4 Implement **Treat unavailable material as an explicit state** so unsafe, unavailable, short, and over-limit articles retain source links and a persisted unavailable state without article model generation; verify an ingestion test renders a story with no article summary and an explicit unavailable result.

## 3. AI generation and ingestion orchestration

- [x] 3.1 Implement **Validated Traditional Chinese article summaries**, **Evidence-grounded discussion summaries**, and **Use structured, validated AI output** with OpenAI Responses structured output, distinct Zod schemas, quoted untrusted inputs, persisted provenance, and comment-ID integrity checks; verify schema tests reject malformed payloads and mixed-evidence fixtures persist null consensus.
- [x] 3.2 Implement **Summary failure and regeneration control** so model calls are limited to concurrency two, invalid output is retryable and unpublished, and regeneration is available only from protected operations; verify a mocked invalid model response has no public summary projection.
- [x] 3.3 Implement **Use one behavior-rich ingestion boundary**, **Idempotent daily RSS snapshot ingestion**, and **Partial failure persistence and run observability** in `npm run ingest:daily`; verify an integration test runs the same Asia/Taipei date twice without duplicates and another fixture records one story failure while independent stories persist.

## 4. APIs and reader experience

- [x] 4.1 Implement public routes `GET /api/digests/latest`, `GET /api/digests/[date]`, and `GET /api/stories/[id]` so invalid or absent resources return the exact safe error envelope; verify route tests assert HTTP 404 and no internal diagnostic fields.
- [x] 4.2 Implement **Authenticated internal operations**, **Use minimal internal authentication and safe errors**, and **Safe production diagnostics** for both internal POST routes; verify authorization tests cover missing and mismatched `INTERNAL_JOB_SECRET`, timing-safe comparison usage, JSON logs, and safe public 500 responses.
- [x] 4.3 Implement **Latest daily editorial reading page**, **Immutable daily archive rendering**, and **Source-grounded story detail rendering** using RSC query projections so pages never call upstream providers on public requests; verify seeded page tests cover empty, not-found, unavailable-article, summary-provenance, representative-comment, and original-link states.
- [x] 4.4 Implement **Use JellyUI for the editorial interface** and **Accessible JellyUI editorial interface** with light/dark modes, restrained HN-orange tokens, semantic landmarks, external-link labels, and visible focus; verify keyboard-focused controls and mobile layout through Playwright assertions.

## 5. Delivery, documentation, and verification

- [x] 5.1 Implement **Railway-compatible application image**, **Private PostgreSQL and migrations**, and **Short-lived UTC Cron ingestion service** with Dockerfile, `.dockerignore`, `.env.example`, `PORT` support, and documented `0 1 * * *` Cron configuration; verify the production image build and an ingestion command exit after closing resources.
- [x] 5.2 Implement **Verifiable quality gates and operations guidance** in `README.md`, `docs/spec.md`, `docs/architecture.md`, `docs/operations.md`, and `tasks/todo.md`; verify documentation review covers environment variables, setup, migrations, seed data, ingestion, Railway Web/Cron, backups, failed-run retry, security boundaries, and acceptance criteria.
- [x] 5.3 Add the critical Playwright journey that seeds a digest, opens `/`, opens one story detail page, and confirms both summary sections plus both original links; verify `npm run lint`, `npm run test`, `npm run test:e2e`, and `npm run build` all pass against the completed project.
