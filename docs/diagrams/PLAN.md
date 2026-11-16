# Plan: 4 system diagrams (Mermaid, docs/diagrams/)

## Context
User needs 4 diagrams: ingestion sequence, TOR data flow + AI recommendation flowchart, full-DB ER, architecture.
`docs/system-architecture.md` already has Mermaid diagrams but they're stale: §5 ER shows 6 of 13 collections and lists a user status `pending` that doesn't exist; §1/§2 are missing the qualification + notification workers and SMTP.
Decision (user): Mermaid in `docs/diagrams/`, one file per diagram; the ER diagram includes every column.

## Files to create
- `docs/diagrams/README.md`: index linking all 4 + the plan
- `docs/diagrams/PLAN.md`: a copy of this plan (user request), linked from the README
- `docs/diagrams/ingestion-sequence.md`: `sequenceDiagram`
- `docs/diagrams/tor-ai-flow.md`: `flowchart` (TOR data flow + AI recommend workflow, 2 diagrams in one file)
- `docs/diagrams/er-diagram.md`: `erDiagram`
- `docs/diagrams/architecture.md`: `flowchart` with subgraphs

Each file: H1 title, 2–4 lines of explanation, a fenced mermaid block, a short legend/notes (source file paths).

## Existing file to edit
- `docs/system-architecture.md`: replace the stale §1, §2, §3 and §5 diagram blocks with short links to the new files, so there is one source of truth. §4 (job states), the tables and the other sections stay as they are.

## 1. ER diagram (source: `app/backend/src/modules/**/*.model.ts`)
MongoDB 7 + Mongoose 9. 14 entities: users, userbookmarks, bidder_profiles, tors, categories, data_sources, ingestion_jobs, collection_runs, audit_logs, settings, tor_notifications, qualification_match_jobs, qualification_matches, sessions.
- Every column with its type plus PK/FK/UK markers. Embedded subdocs (users.qualification, tors.eligibility, bidder_profiles.team/projects, ingestion_jobs.sourceMetadata) are flattened as `object` columns with a comment listing their fields. They don't get separate entities, since they aren't separate collections.
- Relations: data_sources 1-N tors / ingestion_jobs; ingestion_jobs 1-1 tors; users 1-1 bidder_profiles; users N-M tors via userbookmarks, tor_notifications, qualification_match_jobs, qualification_matches; users 1-N collection_runs, audit_logs, sessions; categories linked to tors / users.interests by key (dashed, non-identifying).
- Note: refs are not enforced in MongoDB; the `attempCount` typo is kept as it appears in the model.

## 2. Architecture
Subgraphs:
- Client: browser
- Frontend container: Next.js 16 on :3000
- Backend image `doggo-backend`: api :8000 (Express 5, passport Google OAuth, routes /api/v1/*), queue-producer (10 min), ingestion-worker (5 s), notification-worker (60 s), qualification-worker (10 s, 200 AI calls/day)
- Data: mongo:7 (collections used as queues via lease fields)
- External: Google OAuth, Gemini on Vertex AI, BMA e-GP API, Central e-GP (gprocurement), SMTP
- Edge note: GitHub Actions CI (no deploy)

## 3. Ingestion sequence (`sequenceDiagram`, autonumber)
Participants: Admin UI, API, Queue producer, BMA e-GP, MongoDB, Ingestion worker, Central e-GP, OpenDataLoader (Java), Gemini.
Two phases, separated by `rect` blocks:
- **Discovery** (`be/apps/queue-producer/queue-producer.ts`, `ingestion/ingestion-job.repository.ts`)
  - Triggers, shown as `alt`:
    - Scheduled loop every 10 min: `settings.ingestionEnabled` is checked, and the run is skipped if it's false.
    - Manual run: `POST /admin/ingestion/sync` → `beginBmaSync`, which returns 409 when disabled or busy, otherwise 202.
  - `ensureBmaDataSource` → `claimProducerLease` (15 min; skipped if busy) → `startCollectionRun`.
  - `loop` over keywords × years × pages:
    - `GetProjectFromFilter` → `GetProjectDetail` + `GetTorInProject`, both with `withRetry`.
    - `enqueueDiscoveredProjects`: a bulk upsert. `$setOnInsert` sets `queued`, so existing jobs are never requeued.
    - `updateTorSourceMetadata`.
    - `renewProducerLease`. A lost lease aborts the sync.
  - Finally: `releaseProducerLease` → `finishCollectionRun` + `audit_logs`.
- **Processing** (`be/apps/ingestion-worker/ingestion.worker.ts`, `ingestion/ingestion.service.ts`)
  - `loop` polling every 5 s: `claimNextJob`. It picks jobs that are queued, or failed with the retry time due, or holding an expired lease, and only while `attempCount < 2`.
  - Stages, each renewing the lease via `updateJobStage`:
    1. `fetching_details` (`infoProcureDocAnnounZipTemp`). No docs → `skipped`.
    2. `downloading` (ZIP → `extractTorPdfs`). No TOR PDF → `skipped`.
    3. `extracting_text` (OpenDataLoader → Markdown). Under 200 characters → `review_required`.
    4. `classifying`: `getCategoryCatalog` → Gemini call #1 `analyzeTorWithGemini` (zod v4). Invalid output → `failed`. Not software → `rejected`.
    5. `extracting_fields`: `getSubmitDeadline` (announcement PDF + regex; if that fails, `parseThaiDate` on the LLM's value) → Gemini call #2 `mapEligibility`.
    6. `storing`: `upsertTor`. For protected TORs (admin-edited, verified, or category overridden), only source fields are updated.
  - Results, shown as `alt`:
    - `completeJob`
    - `stopJob` (rejected / skipped / review_required)
    - `failJob` (backoff of 1 min × 5ⁿ, capped at 2 h)
- Note box: Central e-GP is rate-limited to one request per 1.2 s, with 429/5xx retried up to 5 times. Ingestion does **not** enqueue notifications; new TORs reach users through the qualification sweep.

## 4. TOR data flow + AI recommend (`docs/diagrams/tor-ai-flow.md`, 2 flowcharts)
**4a. TOR data flow (LR)**
- Sources: BMA API (metadata) and Central e-GP (TOR ZIP, announcement PDF).
- → `ingestion_jobs.sourceMetadata`. The PDFs go only to a temporary directory and are not persisted.
- → OpenDataLoader → Markdown → Gemini analysis → `TorAnalysis` → Gemini eligibility. In parallel, announcement PDF → regex → deadline.
- → merge. Source metadata wins over LLM values (`torFieldsFromSourceMetadata`).
- → `tors`, with field groups shown as notes (LLM / source / eligibility / audit).
- → API `/api/v1/tors`, `/tors/:id/similar`, `/homepage`, `/reports`, `/admin/tors`.
- → hooks `use-tors.ts`.
- → pages `/homepage`, `/tor/[id]`, `/saved`, `/reports`, `/admin`.

**4b. AI recommend / qualification workflow (TD)**
- Three entry points:
  - Profile edit → `enqueueMatchesForUser` (5 min debounce).
  - 10-min sweep → `sweepMatches` (ready bidder × candidate TOR, missing or stale).
  - TOR detail page → `GET` → if stale, `POST /tors/:id/qualification`. The POST returns 401, 409 or 422 for its guard failures.
- → `qualification_match_jobs` → worker `processNextJob`. Decisions, in order:
  1. Bidder not ready → skipped.
  2. TOR not a candidate → skipped.
  3. Match still fresh → done, no AI call.
  4. Daily cap of 200 AI calls reached → postpone 1 h.
- → `evaluateQualification`:
  - snapshots → Gemini `judge` (prompt v2) → `parseMatchResponse`
  - → `scoreRequirements`, computed in code (met = 1, partial = 0.5); `allMandatoryMet`
  - → `qualification_matches`, keyed by an input version hash with a 30-day staleness limit.
  - Error → retry at 1 min, then 10 min, then failed.
- → UI: card badges via `GET /user/qualification-matches`, and a per-requirement breakdown on the detail page with a re-evaluate button (`force=true`).
- → `enqueueForUser`. Gates: 100% match, can receive notifications, TOR open, match not stale. → `tor_notifications` (one email per user and TOR, ever).
  - Notification worker, every 60 s: re-checks each row → SMTP email → sent or failed (3 attempts).
- Side box: `GET /tors/recommendations` is a **mock** (md5 hash score, top 5) used on the homepage and profile page, and is labelled as not AI.
- Side note: legacy `isFullyQualified` / `tors.eligibility` are unused in live paths.

## Correctness fixes vs the old docs (apply in the new diagrams)
- No `enqueueForTor` from the ingestion worker.
- Two Gemini calls per ingest, not one.
- OpenDataLoader, not Tika.
- The user `status` enum is `active|suspended` only.

## Verification
- Render every block with `npx -y @mermaid-js/mermaid-cli -i <file>.md -o /tmp/out.md` (mmdc parses md). Zero parse errors.
- Cross-check the ER against the model files: `grep -c` of the field count per model.
- Preview on GitHub / VSCode markdown preview.
