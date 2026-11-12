# Flowcharts: TOR data flow and AI recommendation workflow

## 1. TOR data flow

This flowchart follows a TOR from the government sources to the screen. The PDFs are **not persisted**: they exist only in memory or a temporary directory during extraction, and only `documents[]` (fileName, mimeType, sourceUrl) is stored on the TOR.

```mermaid
flowchart LR
  subgraph src["External sources"]
    bma["BMA e-GP API<br/>project list, detail,<br/>announcements, budget,<br/>mid price, contract status"]
    egpZip["Central e-GP<br/>TOR ZIP archive"]
    egpAnn["Central e-GP<br/>announcement PDF"]
  end

  subgraph raw["Raw / staging"]
    job[("ingestion_jobs.sourceMetadata")]
    tmp["temp dir (mkdtemp)<br/>TOR PDFs, deleted after use"]
  end

  subgraph ext["Extraction (ingestion-worker)"]
    odl["OpenDataLoader<br/>PDF → Markdown"]
    g1["Gemini call 1<br/>analyzeTorWithGemini<br/>→ TorAnalysis (zod v4)"]
    g2["Gemini call 2<br/>mapEligibility<br/>→ TorEligibility"]
    dl["announcement text<br/>→ extractSubmitDeadline regex<br/>(else parseThaiDate on LLM value)"]
    merge{"merge fields<br/>source metadata wins<br/>(torFieldsFromSourceMetadata)"}
  end

  subgraph store["MongoDB"]
    tors[("tors")]
    cats[("categories")]
  end

  subgraph apiL["API /api/v1"]
    a1["/tors · /tors/:id<br/>/tors/filters"]
    a2["/tors/:id/similar"]
    a3["/homepage/summary · /analytics"]
    a4["/reports/*"]
    a5["/admin/tors*"]
  end

  subgraph feL["Frontend"]
    hooks["src/api/tor.api.ts<br/>hooks/use-tors.ts"]
    p1["/homepage"]
    p2["/tor/[id]"]
    p3["/saved"]
    p4["/reports"]
    p5["/admin"]
  end

  bma --> job
  egpZip --> tmp --> odl --> g1
  cats -->|category catalog| g1
  g1 -->|bidderQualifications| g2
  egpAnn --> odl
  odl -->|announcement text| dl
  job --> merge
  g1 --> merge
  g2 -->|eligibility| merge
  dl -->|submissionDeadlineAt| merge
  merge -->|upsertTor| tors

  tors --> a1 & a2 & a3 & a4 & a5
  a1 & a2 & a3 & a4 --> hooks
  hooks --> p1 & p2 & p3 & p4
  a5 --> p5
```

Where each group of `tors` fields comes from:

| Source | Fields |
|---|---|
| **BMA source metadata** (wins over the LLM) | departmentName, departmentSubName, projectStatus, sourceProjectId, contractStatus(Code), fiscalYear, announceDate, announcements, budgetBaht, midPriceBaht, awardedPriceBaht |
| **Gemini call 1** | projectTitle, agencyName, summary, objectives, requirements, bidderQualifications, technologies, contactInformation, category, categories, classificationReason, confidence, budgetBaht (only as a fallback) |
| **Gemini call 2** | eligibility |
| **Announcement PDF** | submissionDeadline, submissionDeadlineAt |
| **Audit** | analysisModel, analysisVersion, analyzedAt, ingestionJobId, lastSeenAt |

## 2. AI recommendation / qualification matching workflow

The AI recommendation feature is the **qualification match**. One Gemini call judges each TOR requirement against the bidder profile, and the **score is computed in code**. No embeddings are used. Code: `app/backend/src/modules/qualification/`, `apps/qualification-worker/`, `modules/notification/`, `apps/notification-worker/`.

```mermaid
flowchart TD
  subgraph trig["Triggers"]
    t1["Bidder edits profile<br/>(bidder-profile / user controller)"]
    t2["Sweep every 10 min<br/>sweepMatches()<br/>ready bidder × candidate TOR,<br/>match missing or stale"]
    t3["User opens /tor/[id]<br/>GET /tors/:id/qualification"]
  end

  t1 -->|"enqueueMatchesForUser()<br/>runAfter = now + 5 min (debounce)"| q
  t2 -->|"runAfter = now"| q
  t3 --> stale{"profile complete and<br/>match missing or stale?"}
  stale -->|no| showCache["show cached result"]
  stale -->|yes| post["POST /tors/:id/qualification<br/>(force=true on re-evaluate)"]
  post --> guard{"guards"}
  guard -->|not logged in| e401["401"]
  guard -->|wrong account type /<br/>profile incomplete| e409["409"]
  guard -->|TOR has no requirement text| e422["422"]
  guard -->|"fresh and not force"| showCache
  guard -->|ok| eval

  q[("qualification_match_jobs")] --> claim["qualification-worker<br/>poll 10 s · claimNextJob()"]
  claim --> d1{"bidder ready?<br/>isBidderReady()"}
  d1 -->|no| sk1["skipped"]
  d1 -->|yes| d2{"TOR still candidate?<br/>public, open, has requirements"}
  d2 -->|no| sk2["skipped"]
  d2 -->|yes| d3{"match still fresh?"}
  d3 -->|yes| dn1["done (no AI call)"]
  d3 -->|no| d4{"AI calls in last 24 h<br/>at least 200?"}
  d4 -->|yes| pp["postponeJob +1 h<br/>(attempt not used)"]
  d4 -->|no| eval

  subgraph evalS["evaluateQualification()"]
    eval["buildBidderSnapshot() +<br/>buildTorSnapshot()"]
    eval --> judge["Gemini judge<br/>buildMatchPrompt (v2)"]
    judge --> parse["parseMatchResponse()<br/>each requirement: met / partial /<br/>not_met / unknown + mandatory flag"]
    parse --> score["scoreRequirements() in code<br/>met = 1, partial = 0.5, else 0<br/>percentage = points / count × 100<br/>allMandatoryMet"]
  end

  judge -.->|"AI error"| err{"source"}
  err -->|worker| retry["failJob: retry 1 min → 10 min<br/>→ failed (3 attempts)"]
  err -->|POST| e502["502, previous result kept"]

  score --> save[("qualification_matches<br/>inputVersion = prompt v + sha256(snapshots)<br/>stale if hash differs or older than 30 days")]
  save --> ui1["TOR cards: GET /user/qualification-matches?torIds=<br/>badge ready / stale / pending / failed / ..."]
  save --> ui2["TOR detail: per-requirement breakdown<br/>+ re-evaluate button"]
  save --> efu["enqueueForUser()"]

  efu --> n1{"percentage = 100<br/>and user can receive email<br/>and TOR open<br/>and match not stale?"}
  n1 -->|no| nop["no notification"]
  n1 -->|yes| tn[("tor_notifications<br/>unique (userId, torId): one email per pair, ever")]
  tn --> nw["notification-worker<br/>poll 60 s · claimNextUserBatch()"]
  nw --> rc{"re-check each row"}
  rc -->|no longer eligible| nsk["skipped"]
  rc -->|ok| mail["buildQualifyingTorEmail()<br/>SMTP via nodemailer"]
  mail -->|success| sent["sent"]
  mail -->|error| nf["failed (up to 3 attempts)"]

  save --> reco["GET /tors/recommendations<br/>top 5: open TORs first, closed ones only to fill<br/>score = 0.7 × match % + 0.3 × (interest category ? 100 : 0)<br/>mandatory requirement missed → after the scored ones<br/>no match yet → last, interest category first, then newest<br/>shown on /homepage and /profile"]
```

## Notes

- **Ready bidder:** `isBidderReady()` passes when the account type is personal or company and `profileCompleteness().isComplete` is true. Every profile write also runs `deriveQualification()`, which rewrites the flat `users.qualification`.
- **Candidate TOR** (`findCandidateTors()`): public, deadline null or in the future, and `hasRequirementText()` is true.
- **Legacy path:** `isFullyQualified()` (rule-based, using `tors.eligibility`) is used only by `scripts/seed-notification-user.ts`. The `eligibility` produced by Gemini call 2 currently drives no live feature.
