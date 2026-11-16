# Architecture diagram

TORPulse runs as 7 Docker Compose services (`docker-compose.yml`). The **API** and the **four workers** use the same `doggo-backend` image, each started with a different command. The processes communicate **only through MongoDB**: there is no message broker, and collections act as queues, claimed with lease fields.

```mermaid
flowchart LR
  user(["User / Admin<br/>browser"])

  subgraph compose["Docker Compose"]
    direction LR

    subgraph feC["frontend container :3000"]
      fe["Next.js 16 · React 19<br/>App Router, standalone<br/>TanStack Query · Tailwind v4"]
    end

    subgraph beImg["doggo-backend image (node:22 + OpenJDK 17 JRE)"]
      direction TB
      api["api :8000<br/>Express 5 + Zod<br/>/auth · /api/v1/*<br/>passport Google OAuth<br/>express-session"]
      producer["queue-producer<br/>loop every 10 min<br/>BmaDiscoveryAdapter"]
      ingW["ingestion-worker<br/>poll every 5 s<br/>CentralEgpAdapter · OpenDataLoader (Java)<br/>Gemini extractor"]
      qualW["qualification-worker<br/>poll every 10 s · sweep every 10 min<br/>at most 200 AI calls per day"]
      notifW["notification-worker<br/>poll every 60 s<br/>batch per user"]
    end

    subgraph dataC["mongo container :27017"]
      db[("MongoDB 7<br/>volume mongo-data")]
    end
  end

  subgraph ext["External services"]
    google["Google OAuth 2.0"]
    gemini["Gemini on Vertex AI<br/>@google/genai"]
    bma["BMA e-GP API<br/>egp2.bangkok.go.th"]
    egp["Central e-GP<br/>process5.gprocurement.go.th<br/>1 request per 1.2 s"]
    smtp["SMTP server<br/>nodemailer"]
  end

  ci["GitHub Actions CI<br/>type-check · prettier · tests<br/>lint · build (no deploy)"]

  user -->|HTTPS| fe
  fe -->|"REST /api/v1, cookie torpulse.sid"| api
  api -->|sign-in| google
  api <-->|"models + sessions"| db
  api -.->|"manual sync (202)"| bma
  api -->|"on-demand qualification match"| gemini

  producer -->|"GetProjectFromFilter / Detail / TorInProject"| bma
  producer -->|"lease data_sources, upsert ingestion_jobs, collection_runs, audit_logs"| db

  ingW -->|"claim ingestion_jobs, upsert tors"| db
  ingW -->|"TOR ZIP, announcement PDF"| egp
  ingW -->|"analysis + eligibility (2 calls)"| gemini

  qualW -->|"qualification_match_jobs → qualification_matches, enqueue tor_notifications"| db
  qualW -->|"judge requirements"| gemini

  notifW -->|"claim tor_notifications, read tors / profiles / matches"| db
  notifW -->|email| smtp

  ci -.->|"on PR / push to main, develop"| compose
```

## Notes

- **Backend modules** (`app/backend/src/modules`): auth, user, tor, homepage, report, admin, category, ingestion, notification, qualification.
- **Entry points** (`app/backend/src/apps`): `api`, `queue-producer`, `ingestion-worker`, `notification-worker`, `qualification-worker`.
- **Frontend pages:** `/`, `/homepage`, `/tor/[id]`, `/saved`, `/reports`, `/profile`, `/onboarding`, `/admin`, `/auth`, `/auth/signup`.
- **Not in the stack:** Redis, BullMQ, cron, S3 or other object storage, LINE, and a reverse proxy. PDFs are held only in a temporary directory while they are processed.
- **`NEXT_PUBLIC_API_URL`:** inlined into the frontend image at build time.
