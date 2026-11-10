# Class diagram: domain model

This is a simplified view of the [ER diagram](er-diagram.md). It shows the main domain classes, the few attributes that explain what each one is for, and how the classes relate. Bookkeeping fields (`_id`, `createdAt`, `updatedAt`, lease fields such as `lockedBy` / `lockedUntil`, retry counters, error details) are left out. For every field, see [er-diagram.md](er-diagram.md).

Legend: `*--` composition (an embedded sub-document that cannot exist without its owner), `-->` association (a reference by ObjectId or by key), `..>` dependency (a weak link, such as a link by category key). Numbers on the lines are multiplicities.

```mermaid
classDiagram
  direction LR

  class User {
    name
    email
    role: admin | user
    accountType: personal | company
    interests: categoryKey[]
  }

  class BidderProfile {
    organization
    preferences
  }

  class Person {
    fullName
    roles[]
    yearsExperience
  }

  class PastProject {
    name
    contractValueBaht
    categories[]
  }

  class Category {
    key
    name
    keywords[]
  }

  class DataSource {
    key: bma-egp | govspending-egp
    name
    enabled
  }

  class IngestionJob {
    externalId
    status
    currentStage
  }

  class Tor {
    projectTitle
    agencyName
    budgetBaht
    submissionDeadlineAt
    category
    reviewStatus
  }

  class Eligibility {
    minRegisteredCapitalBaht
    minYearsInBusiness
    requiredCertifications[]
    requiredStaffRoles[]
  }

  class Bookmark

  class TorNotification {
    status: pending | sent | failed
    sentAt
  }

  class QualificationMatchJob {
    status: queued | done | failed
    runAfter
  }

  class QualificationMatch {
    percentage
    allMandatoryMet
    summary
  }

  class MatchRequirement {
    requirement
    mandatory
    status: met | partial | not_met | unknown
    suggestion
  }

  class CollectionRun {
    trigger: scheduled | manual
    status
    createdCount
  }

  class AuditLog {
    actorType: user | system
    action
    targetType
  }

  class Settings {
    ingestionEnabled
    senderEmail
  }

  %% user side
  User "1" --> "0..1" BidderProfile : has
  BidderProfile "1" *-- "1..*" Person : self + team
  BidderProfile "1" *-- "0..*" PastProject : projects
  PastProject "0..*" --> "0..*" Person : members

  %% ingestion side
  DataSource "1" --> "0..*" IngestionJob : discovers
  DataSource "1" --> "0..*" Tor : owns
  IngestionJob "1" --> "0..1" Tor : produces
  Tor "1" *-- "1" Eligibility
  Tor ..> Category : categorised by key

  %% user ↔ TOR
  User "1" --> "0..*" Bookmark
  Bookmark "0..*" --> "1" Tor
  User "1" --> "0..*" TorNotification : receives
  TorNotification "0..*" --> "1" Tor : about
  User "1" --> "0..*" QualificationMatchJob
  QualificationMatchJob "0..*" --> "1" Tor
  User "1" --> "0..*" QualificationMatch
  QualificationMatch "0..*" --> "1" Tor : evaluates
  QualificationMatch "1" *-- "0..*" MatchRequirement

  %% admin / system
  User "0..1" --> "0..*" CollectionRun : triggers
  User "0..1" --> "0..*" AuditLog : acts
  User ..> Category : interests by key
```

## How to read it

- **User side.** A `User` can have one `BidderProfile`, which embeds the company details, its people (`Person`) and its past work (`PastProject`). The qualification matcher reads these to judge a TOR.
- **Ingestion side.** A `DataSource` discovers `IngestionJob`s. Each job that succeeds produces one `Tor`, which embeds the `Eligibility` rules the AI extracted.
- **User and TOR.** `Bookmark`, `TorNotification`, `QualificationMatchJob` and `QualificationMatch` each link one user to one TOR. Each pair (`userId`, `torId`) is unique per class.
- **Admin and system.** `CollectionRun` records ingestion runs, `AuditLog` records admin actions, and `Settings` is a single global document with no relations.
- **Left out:** `sessions` (written by `connect-mongo`, not part of the domain).
