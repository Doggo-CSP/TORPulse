# ER diagram: whole database

TORPulse stores everything in **MongoDB 7**, accessed through **Mongoose 9**. The schema is defined in code, in `app/backend/src/modules/**/*.model.ts`. The diagram shows the 14 collections with their keys and the field that best explains each one. For all fields, read the model files.

Legend: `PK` primary key (`_id`), `FK` a reference by ObjectId (**not enforced** by MongoDB), `UK` a unique index. Dotted lines are links by category `key`, not by ObjectId.

```mermaid
erDiagram
  users ||--o| bidder_profiles : has
  users ||--o{ userbookmarks : saves
  tors ||--o{ userbookmarks : "saved in"
  users ||--o{ qualification_matches : "scored for"
  tors ||--o{ qualification_matches : "scored against"
  users ||--o{ qualification_match_jobs : "queued for"
  tors ||--o{ qualification_match_jobs : "queued for"
  users ||--o{ tor_notifications : receives
  tors ||--o{ tor_notifications : about
  data_sources ||--o{ ingestion_jobs : discovers
  data_sources ||--o{ tors : owns
  ingestion_jobs |o--o| tors : produces
  categories |o..o{ tors : "category key"
  users |o--o{ collection_runs : triggers
  users |o--o{ audit_logs : acts
  users ||--o{ sessions : "logged in"

  users {
    ObjectId _id PK
    string email UK
    enum role "admin | user"
  }
  bidder_profiles {
    ObjectId _id PK
    ObjectId userId FK,UK
  }
  userbookmarks {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId torId FK
  }
  tors {
    ObjectId _id PK
    ObjectId dataSourceId FK
    ObjectId ingestionJobId FK
    string projectTitle
  }
  categories {
    ObjectId _id PK
    string key UK
  }
  data_sources {
    ObjectId _id PK
    string key UK
  }
  ingestion_jobs {
    ObjectId _id PK
    ObjectId dataSourceId FK
    ObjectId torId FK
    enum status
  }
  collection_runs {
    ObjectId _id PK
    ObjectId triggeredBy FK
    enum status
  }
  qualification_match_jobs {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId torId FK
    enum status
  }
  qualification_matches {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId torId FK
    number percentage
  }
  tor_notifications {
    ObjectId _id PK
    ObjectId userId FK
    ObjectId torId FK
    enum status
  }
  audit_logs {
    ObjectId _id PK
    ObjectId actorId FK
    string action
  }
  settings {
    ObjectId _id PK
    string key UK "one global document"
  }
  sessions {
    string _id PK
    date expires "TTL 7 days"
  }
```

## Notes

- **One row per (user, TOR) pair:** `userbookmarks`, `qualification_match_jobs`, `qualification_matches` and `tor_notifications` each have a unique index on `(userId, torId)`.
- **One TOR per source version:** `ingestion_jobs` and `tors` are unique on `(dataSourceId, externalId, sourceVersion)`.
- **Queues:** `ingestion_jobs`, `qualification_match_jobs` and `tor_notifications` are claimed with lease fields (`lockedBy` / `lockedUntil`).
- **`sessions`:** written by `connect-mongo`. It has no Mongoose model.
