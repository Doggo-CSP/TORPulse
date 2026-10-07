# Commands

Every command for running, testing and maintaining TORPulse. Backend commands run from `app/backend`, frontend commands from `app/frontend`. Arguments after `--` go to the script.

Before running backend commands, copy `app/backend/.env.example` to `.env` and fill it in. Commands that touch the database use `MONGODB_URI` / `MONGODB_DATABASE` from that file, so check which database it points at (local or shared Atlas) before running anything that writes.

## Backend: run the services

| Command | What it does |
|---|---|
| `npm run dev` | Starts the REST API (`src/apps/api/server.ts`) on `PORT` (default 8000) with hot reload. Serves `/auth/*` (Google OAuth) and `/api/v1/*`. |
| `npm run dev:producer` | Starts the queue producer with hot reload. It loops through each configured discovery source, enqueues ingestion jobs, then sleeps for `GOVSPENDING_SYNC_INTERVAL_MS`. The sources are: GovSpending when `GOVSPENDING_API_KEY` is set, and BMA unless `BMA_SYNC_ENABLED=false`. |
| `npm run dev:ingestion` | Starts the ingestion worker with hot reload. It claims queued jobs one at a time, downloads the TOR PDFs from Central eGP, extracts the text, classifies it with the AI provider (`AI_PROVIDER`), reads the submission deadline from the announcement PDF and stores the TOR. Needs Java (for OpenDataLoader) and AI credentials. |
| `npm run build` | Compiles TypeScript to `dist/`. |
| `npm start` | Runs the compiled API (`dist/apps/api/server.js`). |
| `npm run start:producer` | Runs the compiled queue producer. |
| `npm run start:ingestion` | Runs the compiled ingestion worker. |

A full local pipeline needs three terminals: `dev`, `dev:producer` and `dev:ingestion`. More than one producer or worker can run at once. Producers share a lease per data source, and workers lease jobs, so no work is done twice.

## Backend: tests and code quality

| Command | What it does |
|---|---|
| `npm test` | Runs every test group below in order and stops at the first failing group. Some route tests need a reachable MongoDB, so use a throwaway local database. CI does this, using a `mongo:7` service container. |
| `npm run test:central-egp` | Central eGP adapter: archive metadata, ZIP download and TOR file selection, throttling and retries. |
| `npm run test:producer` | Discovery adapters (GovSpending, eGP announcement search, BMA) and the Thai fiscal year helper. |
| `npm run test:tor` | TOR model and repository, job queue repository, ingestion report, Thai date parsing, submit deadline extraction, repair and backfill helpers, and the DeepSeek and Gemini extractors. |
| `npm run test:auth` | Auth routes and auth config. |
| `npm run test:user` | Profile, interests and bookmarks: model, repository and routes. |
| `npm run test:homepage` | TOR controller, homepage routes and TOR routes. |
| `npm run test:report` | Report maths (overview, savings buckets, category comparison, timeline, list, similar projects). Pure unit tests, no database. |
| `npm run test:queue-upsert` | Manual check against the configured database. Upserts one test job twice and confirms the queue stays idempotent. |
| `npm run type-check` | `tsc --noEmit`. CI runs it. |
| `npm run format` | Formats the code with Prettier. |
| `npm run format:check` | Checks formatting without writing. CI runs it. |

## Backend: data and maintenance scripts

These scripts write to the configured database unless they are marked read-only.

| Command | What it does |
|---|---|
| `npm run seed:categories` | Inserts any of the 8 default TOR categories that is missing from `categories`, including one an admin deleted. Existing rows are never overwritten. The API and the worker seed only when the collection is empty. |
| `npm run set-admin -- <email>` | Makes a user an active admin. The user must have signed in with Google once first, so that their record exists. |
| `npm run requeue:jobs -- [--dry-run] [--status=failed,rejected]` | Resets finished jobs to `queued`, so a running worker processes them again. With no `--status`, it resets every finished status (`completed`, `failed`, `rejected`, `review_required`, `skipped`). Jobs held by a worker are never touched. |
| `npm run report:job-failures` | **Read-only.** Shows job counts by status and stage, then error messages grouped by both. |
| `npm run repair:missing-tors` | Finds jobs marked `completed` whose TOR record is missing and queues them again. |
| `npm run backfill:deadlines -- [--dry-run]` | Parses the stored `submissionDeadline` text into `submissionDeadlineAt` on existing TORs. No LLM calls. |
| `npm run backfill:egp-details` | Fills department, status and prices on TORs with `sourceAdapter: central_egp` (not `bma_egp`) from the eGP project-detail endpoints. Exits with code 1 if any project fails. |
| `npm run discover:egp -- [--announce-type 1,2,3] [--budget-year 2570] [--max-pages 50] [--dry-run]` | One-off discovery of projects still open for bidding, from the Central eGP announcement search. Needs `EGP_ANNOUNCEMENT_TOKEN`: copy the `X-Announcement-Token` header from a browser search on process5.gprocurement.go.th. The token expires after about 20 minutes. |
| `npm run sandbox:egp -- [--project <id>] [--download] ...` | **Experiment.** Lists eGP announcements, or reads one project, and resolves each submit deadline from its announcement PDF. Writes to `sandbox-output/`, not to the database. |
| `npx tsx src/scripts/seed-homepage-tors.ts` | Seeds sample TORs (`seed-homepage-*` data sources) for the homepage. |
| `npx tsx src/scripts/seed-procurement-reports.ts` | **Outdated, do not run on a shared database.** Seeds priced TORs into `tors`, but the report pages now read finished projects from the newest `tors_bk_*` snapshot, so these rows only pollute the open-TOR list. |

## Frontend

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Next.js dev server on http://localhost:3000. Set `NEXT_PUBLIC_API_URL` (for example `http://localhost:8000`) in `.env.local`. |
| `npm run build` | Production build. CI runs it. |
| `npm start` | Serves the production build. |
| `npm run lint` | ESLint. CI runs it. |

## Queue producer environment

| Variable | Default | Meaning |
|---|---|---|
| `GOVSPENDING_API_KEY` | none | Turns on GovSpending discovery when set. |
| `GOVSPENDING_KEYWORDS` | software-related Thai and English terms | Keywords for the GovSpending search. |
| `GOVSPENDING_FISCAL_YEAR` | current Thai fiscal year | Fiscal year for GovSpending, for example `2569`. |
| `GOVSPENDING_SYNC_INTERVAL_MS` | `600000` | Pause between producer rounds, for every source. |
| `BMA_SYNC_ENABLED` | `true` | Set to `false` to turn off BMA discovery. |
| `BMA_KEYWORDS` | `GOVSPENDING_KEYWORDS` | Keywords sent to the BMA search as `projectSearchText`. BMA titles are Thai. |
| `BMA_BUDGET_YEAR` | current Thai fiscal year | BMA `masterBudgetYearId`, for example `2570`. |
