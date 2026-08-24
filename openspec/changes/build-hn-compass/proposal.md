## Why

Technically literate Traditional Chinese readers need a trustworthy daily Hacker News briefing that distinguishes article substance from community debate while preserving direct paths to the original sources. A persisted, scheduled digest makes the experience fast and predictable without spending AI budget during reader requests.

## What Changes

- Introduce HN Compass as a production-ready Next.js full-stack public website with daily and story-detail editorial experiences.
- Ingest the configured Daemonology HN Daily RSS feed into PostgreSQL snapshots, retrieve bounded Hacker News discussion context, and persist Traditional Chinese AI summaries.
- Add public read-only digest and story APIs plus authenticated internal ingestion and summary-regeneration endpoints.
- Add safety controls for untrusted article URLs, structured JSON logging, retryable ingestion records, OpenAI structured output validation, and persisted generation provenance.
- Package the application for Railway PostgreSQL, Web, and UTC-scheduled Cron services, with tests and operational documentation.

## Capabilities

### New Capabilities

- `daily-digest-ingestion`: Creates idempotent, observable daily snapshots from RSS, accessible article content, and bounded Hacker News comment traversal.
- `safe-ai-summarization`: Produces validated, persisted Traditional Chinese article and discussion summaries without treating upstream material as instructions.
- `public-digest-reading`: Provides accessible, responsive home, archive, and story-detail reading experiences backed only by persisted data.
- `digest-api-and-operations`: Defines safe public read APIs, secret-protected internal operations, error contracts, and ingestion observability.
- `railway-production-deployment`: Provides a reproducible Docker and Railway topology, local setup guidance, migrations, and Cron operations.

### Modified Capabilities

(none)

## Impact

- Affected specs: `daily-digest-ingestion`, `safe-ai-summarization`, `public-digest-reading`, `digest-api-and-operations`, `railway-production-deployment`.
- Affected code:
  - New: `package.json`, `next.config.ts`, `tsconfig.json`, `src/app/`, `src/components/`, `src/server/`, `src/db/`, `src/cli/`, `drizzle/`, `tests/`, `playwright.config.ts`, `Dockerfile`, `.dockerignore`, `.env.example`.
  - New documentation: the repository README, product specification, architecture guide, operations guide, and implementation checklist.
  - Modified: `openspec/changes/build-hn-compass/` proposal artifacts.
  - Removed: none.
- New dependencies include Next.js, React, TypeScript, Tailwind CSS, JellyUI, Drizzle ORM, PostgreSQL driver, Zod, OpenAI SDK, Vitest, Playwright, and bounded-concurrency tooling.
