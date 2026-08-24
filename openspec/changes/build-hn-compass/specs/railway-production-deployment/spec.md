## ADDED Requirements

### Requirement: Railway-compatible application image
The repository SHALL provide a Dockerfile and `.dockerignore` that build the Next.js application for production and run the web process on Railway's `PORT`. The repository SHALL provide `.env.example` without secrets and document all required variables.

#### Scenario: Production container starts
- **WHEN** Railway deploys the web service with `DATABASE_URL` and `PORT`
- **THEN** the application process starts and listens on the supplied port

### Requirement: Private PostgreSQL and migrations
The application SHALL use Railway-provided `DATABASE_URL` for a private PostgreSQL service and Drizzle migrations for schema creation. Documentation SHALL describe migration application and backup considerations without exposing public database networking.

#### Scenario: Fresh environment is prepared
- **WHEN** an operator configures a new Railway PostgreSQL service and applies migrations
- **THEN** the required digest, story, comment, summary, and ingestion-run tables and indexes exist

### Requirement: Short-lived UTC Cron ingestion service
A second Railway service SHALL use the same repository image, run `npm run ingest:daily`, and use UTC cron expression `0 1 * * *` for 09:00 Asia/Taipei. The command SHALL terminate after work and leave no open connections so later schedules are eligible to run.

#### Scenario: Cron execution completes
- **WHEN** Railway starts the Cron service
- **THEN** the service runs one ingestion attempt, closes resources, persists its run result, and exits

### Requirement: Verifiable quality gates and operations guidance
The repository SHALL document local setup, PostgreSQL setup, variables, migrations, seed data, ingestion, Railway web and Cron configuration, failed-run retry, and troubleshooting. It SHALL provide lint, unit/integration test, E2E test, and production build commands.

#### Scenario: Operator follows local verification instructions
- **WHEN** an operator follows documented setup with required variables and a test database
- **THEN** the operator can run lint, tests, E2E test, build, and daily ingestion commands
