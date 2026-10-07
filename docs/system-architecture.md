# System architecture

The diagrams below cover all of TORPulse, from the outside systems down to the job lifecycle. They are written in Mermaid, which GitHub renders. For per-field detail of the ingestion pipeline, see `tor-extractor.md`. For how to run each piece, see `commands.md`.

## 1. System context

```mermaid
flowchart LR
  user([User / Admin<br/>browser])

  subgraph torpulse[TORPulse]
    fe[Frontend<br/>Next.js]
    api[REST API<br/>Express]
    producer[Queue producer]
    worker[Ingestion worker]
    db[(MongoDB)]
  end

  google[Google OAuth 2.0]
  bma[BMA e-GP<br/>egp2.bangkok.go.th]
  egp[Central e-GP<br/>process5.gprocurement.go.th]
  ai[AI provider<br/>Gemini on Vertex AI or DeepSeek]

  user --> fe
  fe -- "/api/v1, /auth (cookie session)" --> api
  api -- sign-in --> google
  api <--> db
  producer -- "ประกาศเชิญชวน projects (by keyword)" --> bma
  producer -- enqueue jobs --> db
  worker -- "claim jobs, store TORs" --> db
  worker -- "TOR ZIP, announcement PDF" --> egp
  worker -- classify + extract --> ai
```

The three backend processes run separately and share only MongoDB. There is no message broker: the `ingestion_jobs` collection is the queue.

## 2. Containers and modules

```mermaid
flowchart TB
  subgraph frontend[app/frontend: Next.js App Router]
    pages["Pages: / · /homepage · /tor/[id] · /saved · /reports · /profile · /admin · /auth"]
    apiClient["src/api/*: tor, homepage, user, reports, admin"]
    pages --> apiClient
  end

  subgraph backend[app/backend]
    subgraph apiApp[apps/api]
      auth["/auth: google, callback, me, logout"]
      v1["/api/v1"]
    end
    subgraph modules[modules]
      torM[tor]
      homeM[homepage]
      userM[user]
      reportM[report]
      adminM[admin]
      catM[category]
      ingM[ingestion]
    end
    subgraph producerApp[apps/queue-producer]
      bmaA[BmaDiscoveryAdapter]
    end
    subgraph workerApp[apps/ingestion-worker]
      svc[ingestion.service]
      egpA[CentralEgpAdapter]
      odl[OpenDataLoader<br/>PDF → Markdown]
      llm[DeepSeek / Gemini extractor]
      deadline[egp-submit-deadline<br/>+ thai-date]
    end
    notif["apps/notification-worker<br/>(placeholder, not implemented)"]
  end

  apiClient --> auth
  apiClient --> v1
  v1 --> torM & homeM & userM & reportM & adminM & catM & ingM
  producerApp --> ingM
  svc --> egpA
  svc --> odl
  svc --> llm
  egpA --> deadline --> odl
  svc --> torM
```

## 3. Ingestion pipeline

```mermaid
sequenceDiagram
  autonumber
  participant P as Queue producer
  participant B as BMA e-GP
  participant DB as MongoDB
  participant W as Ingestion worker
  participant E as Central e-GP
  participant AI as Gemini / DeepSeek

  loop every DISCOVERY_SYNC_INTERVAL_MS
    P->>DB: claim lease on data source (bma-egp)
    loop each BMA_KEYWORDS
      P->>B: GetProjectFromFilter?projectSearchText&ประกาศเชิญชวน&e-bidding&budgetYear
      P->>DB: upsert ingestion_jobs (bma_egp), projectNumber = eGP id
    end
    P->>DB: release lease
  end

  loop poll every 5s
    W->>DB: claimNextJob (lease 5 min, attempt +1)
    W->>E: infoProcureDocAnnounZipTemp (archive metadata)
    alt no announcement archive
      W->>DB: job → skipped
    end
    W->>E: downloadFileTest (ZIP) → tor_*, Attach_TOR_*, doc_* PDFs
    W->>W: OpenDataLoader → Markdown (OCR needed → review_required)
    W->>AI: classify + extract fields (category catalog from categories)
    alt not software related
      W->>DB: job → rejected
    end
    W->>E: infoProcureDocAnnounZip → templateId, view-pdf → announcement PDF
    W->>W: parse "เสนอราคา…ในวันที่ ๑๒ ตุลาคม ๒๕๖๙ … ถึง ๑๖.๐๐ น." → submissionDeadlineAt
    W->>DB: upsert tors, job → completed
  end
```

The deadline read from the announcement PDF takes priority over the LLM's reading; the LLM value is used only when the PDF gives no date. All Central e-GP requests in a process go through a single limiter, spaced 1.2 s apart. HTTP 429 and 5xx responses are retried with backoff.

## 4. Ingestion job lifecycle

```mermaid
stateDiagram-v2
  [*] --> queued: producer upsert (new project)
  queued --> processing: claimNextJob
  processing --> completed: TOR stored
  processing --> rejected: AI says not software
  processing --> skipped: no announcement archive / no TOR PDF
  processing --> review_required: OCR needed / no documents / unknown adapter
  processing --> failed: error thrown
  failed --> processing: nextRetryAt reached and attempts < 2
  processing --> processing: lease expired (worker crashed), reclaimed
  completed --> queued: requeue:jobs / repair:missing-tors
  rejected --> queued: requeue:jobs
  skipped --> queued: requeue:jobs
  review_required --> queued: requeue:jobs
  failed --> queued: requeue:jobs
```

Stages inside `processing`: `fetching_details` → `downloading` → `extracting_text` → `classifying` → `extracting_fields` → `storing`.

## 5. Data model

```mermaid
erDiagram
  data_sources ||--o{ ingestion_jobs : "discovers"
  data_sources ||--o{ tors : "owns"
  ingestion_jobs |o--o| tors : "produces (torId)"
  categories ||--o{ tors : "category / categories[] (by key)"
  categories ||--o{ users : "interests[] (by key)"
  users ||--o{ userbookmarks : "saves"
  tors ||--o{ userbookmarks : "saved as"
  users ||--o{ sessions : "logged-in session"

  data_sources {
    string key UK "bma-egp | govspending-egp (legacy key, used by discover:egp)"
    bool enabled
    string lockedBy "producer lease"
    date lockedUntil
    date lastSucceededAt
  }
  ingestion_jobs {
    ObjectId dataSourceId
    string externalId "eGP project id (11 digits)"
    string sourceVersion "unique with dataSourceId+externalId"
    string sourceAdapter "central_egp | bma_egp"
    string status
    string currentStage
    object sourceMetadata "title, department, status, year, prices"
    int attempCount
    date nextRetryAt
  }
  tors {
    ObjectId dataSourceId
    string externalId
    string projectTitle
    string agencyName
    string category
    number budgetBaht
    number midPriceBaht
    number awardedPriceBaht
    string submissionDeadline "raw Thai text"
    date submissionDeadlineAt
    string analysisModel
  }
  categories {
    string key UK "immutable"
    string name UK
    string aiHint
    string keywords
    bool isActive
    int sortOrder
  }
  users {
    string email
    string role "admin | user"
    string status "active | pending | suspended"
  }
  userbookmarks {
    ObjectId userId
    ObjectId torId
  }
```

## 6. Discovery sources

| Source | Data source key | Job `sourceAdapter` | What it finds | Auth |
|---|---|---|---|---|
| BMA e-GP | `bma-egp` | `bma_egp` | Bangkok ประกาศเชิญชวน e-bidding projects (still open for bids), matched by keyword and budget year | none |
| eGP announcement search (manual `discover:egp`) | `govspending-egp` | `central_egp` | ร่างประกาศ / ประกาศเชิญชวน on Central e-GP | Turnstile token copied from a browser |

GovSpending discovery was removed because it only lists projects that already have a contract. Its `govspending-egp` data source key is kept for the manual eGP announcement search, so existing jobs and TORs stay linked.

Every source ends up as an 11-digit Central e-GP project id. That's why one worker, using `CentralEgpAdapter`, processes jobs from all of them.

## 7. API surface (`/api/v1`)

| Prefix | Endpoints | Used by |
|---|---|---|
| `/tors` | `GET /`, `GET /:id`, `GET /filter-options`, `GET /recommendations`, `GET /:id/similar` | TOR list and detail pages (`/:id/similar` = similar finished projects, UC-05) |
| `/homepage` | `GET /summary`, `GET /analytics` | Homepage dashboard |
| `/user` | `GET/PUT /profile`, `PUT /interests`, `GET /bookmarks`, `POST /bookmarks/:torId` | Profile and saved pages |
| `/reports` | `GET /price-overview`, `/savings-distribution`, `/category-comparison`, `/timeline`, `/procurement-list`, `/filters/departments` | Reports page (finished projects, see below) |
| `/admin` | `GET /stats` · `GET /users`, `GET/PATCH /users/:userId`, `PATCH /users/:userId/role`, `PATCH /users/:userId/status` · `GET /activity` · `GET/PATCH /settings` · `GET /tors`, `GET/PATCH/DELETE /tors/:torId`, `POST /tors/:torId/verify`, `POST /tors/:torId/archive` · `GET /ingestion/status`, `POST /ingestion/sync` · `GET/POST /categories`, `PATCH/DELETE /categories/:categoryId`, `PATCH /categories/:categoryId/status` | Admin page (admin role only) |
| `/ingestion` | `GET /report` | Not called by the frontend yet (ops, job status report) |
| `/categories` | `GET /` | Not called by the frontend yet (active category list) |

Auth lives outside `/api/v1`: `GET /auth/google`, `GET /auth/google/callback`, `GET /auth/me` and `POST /auth/logout`. Sessions are stored in the MongoDB `sessions` collection, using the `torpulse.sid` cookie.

## 8. Open TORs and finished projects

TORs live in two places, for two questions:

| Data | Collection | Answers | Used by |
|---|---|---|---|
| Open TORs (ร่าง TOR, ประกาศเชิญชวน, ประกาศราคากลาง) | `tors` | "What can I bid on?" Mid price, awarded price and announce date are normally empty here, because the project has not finished. | TOR list and detail, homepage counts (UC-04), admin |
| Finished projects (contract signed) | newest `tors_bk_YYYYMMDD` snapshot | "What did work like this end at, and how much was saved?" | `/reports/*`, homepage price chart and cards, `/tors/:id/similar` (UC-05) |

The snapshots are **read-only**: `modules/report/finished-tors.ts` only lists collections and runs `find()`. It picks the newest `tors_bk_YYYYMMDD` by name, keeps the projects that have both a mid and an awarded price, and caches them in memory for 30 minutes. Each report response includes `source` (collection, snapshot date, project count). Report dates use `announceDate`, falling back to `analyzedAt`. The report maths is in `report.calculations.ts` and is unit tested without a database.
