# Class diagram: domain model

This is the core domain model: the classes a bidder and a TOR are made of, and how they meet. Bookkeeping classes (`QualificationMatchJob`, `CollectionRun`, `AuditLog`, `Settings`, bookmarks, sessions) and bookkeeping fields are left out; see the [ER diagram](er-diagram.md) for every collection.

Legend: `*--` composition (an embedded sub-document that cannot exist without its owner), `-->` association (a reference by ObjectId), `..>` a link by category key. Numbers on the lines are multiplicities.

```mermaid
classDiagram
  direction LR

  class User {
    email
    role
    accountType
  }
  class BidderProfile
  class Person {
    roles[]
    yearsExperience
  }
  class PastProject {
    contractValueBaht
  }
  class Category {
    key
  }
  class DataSource
  class IngestionJob {
    status
  }
  class Tor {
    projectTitle
    requirements[]
    submissionDeadlineAt
  }
  class QualificationMatch {
    percentage
  }
  class MatchRequirement {
    status: met | partial | not_met | unknown
  }
  class TorNotification {
    status
  }

  User "1" --> "0..1" BidderProfile
  BidderProfile "1" *-- "1..*" Person : self + team
  BidderProfile "1" *-- "0..*" PastProject

  DataSource "1" --> "0..*" IngestionJob : discovers
  IngestionJob "1" --> "0..1" Tor : produces
  Tor ..> Category

  User "1" --> "0..*" QualificationMatch
  QualificationMatch "0..*" --> "1" Tor : evaluates
  QualificationMatch "1" *-- "0..*" MatchRequirement
  User "1" --> "0..*" TorNotification
  TorNotification "0..*" --> "1" Tor
```

## How to read it

- **Bidder side.** A `User` can have one `BidderProfile`, which embeds its people (`Person`) and past work (`PastProject`).
- **TOR side.** A `DataSource` discovers `IngestionJob`s, and each successful job produces one `Tor`.
- **Where they meet.** A `QualificationMatch` scores one user against one TOR, requirement by requirement. A 100% match creates a `TorNotification`.
