# Sequence diagram: ingestion pipeline

Ingestion happens in two phases that run in separate processes and share only MongoDB:

1. **Discovery** (queue-producer, or the admin "sync now" button). Finds BMA projects and upserts `ingestion_jobs`.
2. **Processing** (ingestion-worker). Claims each job, downloads the TOR PDFs, extracts text, calls Gemini twice, and upserts `tors`.

Code: `app/backend/src/apps/queue-producer/queue-producer.ts`, `apps/ingestion-worker/ingestion.worker.ts`, `modules/ingestion/ingestion.service.ts`, `modules/ingestion/ingestion-job.repository.ts`, `modules/tor/tor.repository.ts`.

```mermaid
sequenceDiagram
  autonumber
  actor A as Admin UI
  participant API as API (Express)
  participant P as Queue producer
  participant B as BMA e-GP API
  participant DB as MongoDB
  participant W as Ingestion worker
  participant E as Central e-GP
  participant O as OpenDataLoader (Java)
  participant G as Gemini (Vertex AI)

  rect rgba(120, 160, 255, 0.12)
  Note over A,DB: Phase 1: Discovery
  alt scheduled (every DISCOVERY_SYNC_INTERVAL_MS, default 10 min)
    P->>DB: getSettings()
    opt ingestionEnabled = false
      P-->>P: skip this run
    end
  else manual
    A->>API: POST /api/v1/admin/ingestion/sync
    API->>DB: beginBmaSync() (lease check)
    alt disabled or busy
      API-->>A: 409
    else lease acquired
      API-->>A: 202 Accepted (sync continues in background)
    end
  end
  P->>DB: ensureBmaDataSource()
  P->>DB: claimProducerLease() on data_sources (15 min)
  opt source disabled or lease held elsewhere
    P-->>P: skip (disabled / busy)
  end
  P->>DB: expireStaleCollectionRuns() + startCollectionRun()
  loop each keyword × budget year × page (100 per page)
    P->>B: GetProjectFromFilter (keyword, ประกาศเชิญชวน, e-bidding)
    B-->>P: projects
    par per project (limited concurrency, withRetry 500ms×2ⁿ)
      P->>B: GetProjectDetail
      P->>B: GetTorInProject (announcements)
    end
    P->>DB: enqueueDiscoveredProjects() bulk upsert ingestion_jobs
    Note right of DB: key (dataSourceId, externalId, sourceVersion)<br/>$set sourceMetadata always<br/>$setOnInsert status=queued (no requeue)
    P->>DB: updateTorSourceMetadata() on existing tors (no LLM)
    P->>DB: renewProducerLease()
    opt lease lost
      P-->>P: throw ProducerLeaseLostError, abort sync
    end
  end
  P->>DB: releaseProducerLease()
  P->>DB: finishCollectionRun() + audit_logs (ingestion.completed / failed)
  end

  rect rgba(120, 220, 160, 0.12)
  Note over W,G: Phase 2: Processing
  W->>DB: seedCategoriesIfEmpty() (once at startup)
  loop poll every 5 s
    W->>DB: claimNextJob()
    Note right of DB: queued, or failed with nextRetryAt due,<br/>or processing with expired lease.<br/>Needs attempCount under 2.<br/>Sets processing, lease 5 min, attempt +1
    alt unknown sourceAdapter
      W->>DB: stopJob(review_required)
    else bma_egp / central_egp
      W->>DB: updateJobStage(fetching_details)
      W->>E: infoProcureDocAnnounZipTemp (archive metadata)
      opt data null (E0001)
        W->>DB: stopJob(skipped) (NoTorDocumentsError)
      end
      W->>DB: updateJobStage(downloading)
      W->>E: downloadFileTest?fileId= (ZIP)
      W->>W: extractTorPdfs() keeps tor_*, Attach_TOR_*, doc_*<br/>size / zip-bomb / path checks
      opt no TOR PDF
        W->>DB: stopJob(skipped)
      end
      W->>DB: updateJobStage(extracting_text)
      W->>O: extractDocumentsToMarkdown() (cap 300k chars)
      O-->>W: Markdown
      opt fewer than 200 meaningful chars (OcrRequiredError)
        W->>DB: stopJob(review_required)
      end
      W->>DB: updateJobStage(classifying)
      W->>DB: getCategoryCatalog() (active categories)
      W->>G: Call 1: analyzeTorWithGemini(markdown, catalog)
      G-->>W: JSON validated by parseTorAnalysis() (zod, v4)
      alt invalid JSON
        W->>DB: failJob() (retry later)
      else isSoftwareRelated = false
        W->>DB: stopJob(rejected)
      end
      W->>DB: updateJobStage(extracting_fields)
      W->>W: normalizeCategories()
      W->>E: getSubmitDeadline(): infoProcureDocAnnounZip → view-pdf
      W->>O: announcement PDF → text
      W->>W: extractSubmitDeadline() regex, else parseThaiDate(LLM value)
      opt bidderQualifications not empty
        W->>G: Call 2: mapEligibility(bidderQualifications)
        G-->>W: structured eligibility
      end
      W->>DB: updateJobStage(storing)
      W->>DB: upsertTor() keyed (dataSourceId, externalId, sourceVersion)
      Note right of DB: protected TOR (admin-edited / verified /<br/>categoryOverridden): source fields only.<br/>Source metadata wins over LLM values.
      W->>DB: completeJob(torId)
    end
    opt any thrown error
      W->>DB: failJob() backoff 1 min × 5ⁿ (max 2 h), MAX_ATTEMPTS = 2
    end
  end
  end

  Note over W,E: Central e-GP: one limiter per process (1 request per 1.2 s).<br/>429 / 5xx / network errors retried up to 5 times, then CentralEgpRateLimitError → failed.
  Note over P,W: Ingestion does NOT enqueue notifications. New TORs reach users through<br/>the qualification worker's 10-min sweep (see tor-ai-flow.md).
```
