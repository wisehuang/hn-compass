# Operations guide

## Environment variables

| Variable | Required by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Web, migration, Cron | Railway private PostgreSQL connection URL |
| `RSS_URL` | Cron, internal ingestion | Daemonology HN Daily RSS URL |
| `KAGI_API_KEY` | Cron, summary regeneration | Server-only Kagi Universal Summarizer credential, used as the article fallback |
| `KAGI_SUMMARIZER_ENGINE` | Cron, summary regeneration | Kagi engine, such as `agnes` |
| `OPENAI_API_KEY` | Cron, summary regeneration | Server-only OpenAI credential for article and discussion summaries |
| `OPENAI_MODEL` | Cron, summary regeneration | OpenAI structured-output model for discussion summaries |
| `OPENAI_ARTICLE_MODEL` | Optional | Article-summary model; falls back to `OPENAI_MODEL` when unset |
| `ARTICLE_EXTRACTION_MIN_CONFIDENCE` | Optional | Extraction score at or above which OpenAI summarizes locally extracted text; defaults to `0.6`. Values outside `0`–`1` are ignored |
| `KAGI_FALLBACK_ENABLED` | Optional | Set to `false` to disable the Kagi fallback entirely and observe OpenAI-only quality |
| `GITHUB_TOKEN` | Optional | Raises the GitHub API rate limit used to read repository READMEs |
| `INTERNAL_JOB_SECRET` | Internal POST routes | Long random secret for timing-safe internal authorization |
| `PORT` | Web | Supplied by Railway; do not hard-code it |
| `TEST_DATABASE_URL` | Optional local tests | Disposable test PostgreSQL database |

Never commit `.env.local` or put any of these values in `NEXT_PUBLIC_*`. Do not expose the PostgreSQL service publicly.

## Local PostgreSQL, migration, data, and verification

Create two local databases (for example `hn_compass` and `hn_compass_test`), copy `.env.example` to `.env.local`, then replace its placeholder values. Load it before every CLI command because the standalone TypeScript CLIs do not load `.env.local` themselves:

```bash
set -a; source .env.local; set +a
pnpm db:migrate
pnpm ingest:daily       # the operational seed: stores the current Taipei digest
pnpm dev
```

The product deliberately has no fabricated production seed command. For an isolated reader demo use the E2E fixture through `pnpm test:e2e`; for real local data use one ingestion run. Test setup may use `TEST_DATABASE_URL`, then run all gates:

```bash
pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```

## Railway deployment

Prepare one Railway project with these **three long-lived services**:

1. **PostgreSQL** — add Railway PostgreSQL. Keep it private; its generated `DATABASE_URL` is the only database endpoint required by the app.
2. **Web** — add a GitHub-repository service. Railway detects `Dockerfile`; deploy from the default branch. Its start command is the Docker default, `node server.js`, which runs the Next.js standalone server as the unprivileged `node` user. Generate a public domain after it is healthy.
3. **Cron** — add a second service from the same repository and Dockerfile. Give it the custom start command `npm run ingest:daily`, configure schedule **`0 1 * * *`**, and attach the same PostgreSQL service. Railway schedules Cron in UTC, so this is 09:00 Asia/Taipei.

Set shared variables on both Web and Cron: `DATABASE_URL` (reference the private PostgreSQL variable), `RSS_URL`, `KAGI_API_KEY`, `KAGI_SUMMARIZER_ENGINE`, `OPENAI_API_KEY`, `OPENAI_MODEL`, and a newly generated `INTERNAL_JOB_SECRET`. The optional article-routing variables above may be left unset to take the defaults. Railway provides `PORT` to Web; do not set a fixed value. Cron does not need a public domain.

Before enabling Cron, run a one-shot migration from the same image with command `npm run db:migrate`. This can be a temporary Railway service/deployment; wait for exit code 0, then delete or disable it. For later compatible schema releases, run the same command before deploying application code that depends on the new schema.

After the first migration, manually run the Cron service once. Check its JSON logs and `ingestion_runs`, then visit the Web domain. If it succeeds, enable the schedule. Keep the Docker builder selected; no Nixpacks configuration is required.

## Failure, retry, backup, and rollback

- A `PARTIAL_FAILURE` run preserves successfully ingested stories. Re-run the Cron service (or `pnpm ingest:daily`) to retry the same Taipei date safely; unique keys make it idempotent.
- A `FAILED` run records a safe error summary and metrics. Inspect Railway Cron logs, confirm the database, RSS, Kagi, and OpenAI variables plus outbound network access, then re-run once after correction.
- Article summaries are routed per story. Ingestion extracts the article itself (a dedicated API for GitHub and arXiv URLs, `unpdf` for PDFs, Mozilla Readability for ordinary pages) and scores that extraction from 0 to 1. At or above `ARTICLE_EXTRACTION_MIN_CONFIDENCE` the extracted text goes to OpenAI; below it, or when extraction failed outright, the article URL goes to Kagi, which applies its own retrieval to pages local extraction cannot parse. An OpenAI failure also falls back to Kagi.
- Kagi bills prepaid API credits; if credits are exhausted, ARTICLE summary work remains retryable while independent DISCUSSION work can persist. Restore the previous application release and its article provider configuration to roll back.
- Each run's `metrics_json` carries `articleSummariesOpenAi`, `articleSummariesKagi`, and `articleSummariesCached`, which is the direct measure of Kagi spend per run. `stories.article_extractor` and `stories.article_extraction_confidence` record how each story was read, so the threshold can be retuned against the observed score distribution.
- Enable Railway PostgreSQL backups according to the selected plan and periodically test a restore into a separate project. Do not use a public database URL as a substitute for backups.
- Roll back a bad Web/Cron image in Railway. Keep migrations backward compatible; restore PostgreSQL only for actual data loss, not an application rollback.

## Security boundaries

Reader requests never trigger upstream network or model work. `INTERNAL_JOB_SECRET` protects writes but is not a substitute for a public admin UI; restrict who can access it. The database URL, Kagi and OpenAI keys, raw upstream failures, stack traces, and model responses belong only in server-side secret storage or logs, never in public API output.
