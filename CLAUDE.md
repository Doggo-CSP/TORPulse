# CLAUDE.md

TORPulse: discovers Thai government software procurement projects (TOR = Terms of Reference), downloads their TOR PDFs, extracts fields with an LLM, and serves them through a dashboard. UI text and much of the domain data are Thai.

## Read first

- [docs/system-architecture.md](docs/system-architecture.md): system diagrams, ingestion pipeline, job lifecycle, data model, API surface.
- [docs/commands.md](docs/commands.md): every npm script, with what it writes to.
- [docs/tor-extractor.md](docs/tor-extractor.md): per-field extraction detail.
- [CONTRIBUTING.md](CONTRIBUTING.md): branch names (`feature/x`, `fix/x`), Conventional Commits, PRs target `develop`.

Keep these docs updated when changing the pipeline, endpoints or scripts.

## Layout

Two independent npm packages, no workspace root. Run commands from the package directory.

- `app/backend`: Express 5 + Mongoose 9, ESM TypeScript run with `tsx`. Three separate processes that share only MongoDB:
  - `src/apps/api`: REST API. `/auth/*` (Google OAuth, session cookie `torpulse.sid` stored in Mongo) and `/api/v1/*` (routers mounted in `src/apps/api/r.route.ts`).
  - `src/apps/queue-producer`: discovery adapters (GovSpending, BMA e-GP) upsert jobs into the `ingestion_jobs` collection. That collection is the queue; there is no broker.
  - `src/apps/ingestion-worker`: claims jobs by lease, downloads PDFs from Central e-GP, converts them with OpenDataLoader (needs Java), classifies and extracts with Gemini or DeepSeek (`AI_PROVIDER`), stores into `tors`.
  - `src/apps/notification-worker`: placeholder, not implemented.
  - `src/modules/<domain>/`: `*.routes.ts` → `*.controller.ts` → `*.repository.ts` → `*.model.ts`, plus `*.validation.ts` (Zod) and `*.types.ts`. Domains: tor, homepage, user, report, admin, category, auth, ingestion.
  - `src/scripts/`: seed, migrate, backfill, repair and requeue CLIs. Most write to the configured DB.
  - `src/config/env.ts`: all env vars are parsed and validated here. Import `env` rather than reading `process.env`.
- `app/frontend`: Next.js 16 App Router, React 19, Tailwind v4, TanStack Query v5, Recharts. `@/*` maps to `src/*`.
  - `src/api/*.api.ts`: fetch functions and response types (mirror the backend types by hand; update both sides together).
  - `src/hooks/use-*.ts`: React Query hooks wrapping the API functions.
  - `src/app/<route>/page.tsx`: pages (`homepage`, `tor/[id]`, `saved`, `reports`, `profile`, `admin`, `auth`).

## Commands

Backend (`app/backend`, needs `.env` copied from `.env.example`):

```bash
npm run dev               # API on :8000
npm run dev:producer      # queue producer
npm run dev:ingestion     # ingestion worker
npm run type-check        # CI
npm run format:check      # CI (Prettier: no semicolons, single quotes, width 100)
npm test                  # all groups; some route tests need a reachable MongoDB
npx tsx --test src/modules/tor/tor.controller.test.ts   # single test file
```

`npm test` is a chain of `test:*` groups listed in `package.json`. A new test file must be added to one of those groups, or it will not run in CI.

Frontend (`app/frontend`, needs `NEXT_PUBLIC_API_URL` in `.env.local`):

```bash
npm run dev     # :3000
npm run lint    # CI
npm run build   # CI
```

CI ([.github/workflows](.github/workflows)) runs backend type-check, format check and tests against a `mongo:7` service, and frontend lint and build.

## Conventions and gotchas

- Backend imports use `.js` extensions on relative paths (`nodenext` resolution). `noUncheckedIndexedAccess` is on.
- Backend tests use `node:test` + `node:assert/strict`, with `supertest` for routes. Repository tests usually stub Mongoose model methods instead of hitting a DB.
- Categories live in the `categories` collection and are managed by admins. Read them via `category.repository.ts`. `category.constants.ts` is seed data only. TORs reference categories by `key`; legacy keys are renamed by `npm run migrate:categories`.
- Public TOR queries must apply `publicTorFilter()` from `tor.model.ts` (hides archived/deleted TORs and drafts unpublished for `STALE_DRAFT_DAYS`, unless verified).
- `tor.controller.ts` holds pure helpers (`deriveCategory`, `compareByDeadline`, `toTorListItem`) shared with homepage and report modules.
- Dates: Thai Buddhist-era text is parsed by `modules/ingestion/thai-date.ts`. The submission deadline from the announcement PDF overrides the LLM's value.
- Admin routes use `requireAdmin` from `middleware/admin.middleware.ts`. User-facing error messages are in Thai.
- Scripts and dev servers use `MONGODB_URI`/`MONGODB_DATABASE` from `.env`. Check whether it points at a local DB or shared Atlas before running anything that writes.
- Never commit `.env` files. `sandbox-output/` and `dist/` are git-ignored.
