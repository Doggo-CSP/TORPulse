# Diagrams

These are the TORPulse system diagrams, written in Mermaid so that GitHub and the VSCode markdown preview render them. They were traced from the code as of 2026-11-08.

| Diagram | Type | What it shows |
|---|---|---|
| [ingestion-sequence.md](ingestion-sequence.md) | Sequence | Discovery by the queue producer and processing by the ingestion worker, including every branch and retry |
| [tor-ai-flow.md](tor-ai-flow.md) | Flowchart ×2 | How TOR data flows from source to screen, and the AI qualification-match workflow through to email notifications |
| [er-diagram.md](er-diagram.md) | ER | All 14 MongoDB collections with every field, plus their relations and unique keys |
| [class-diagram.md](class-diagram.md) | Class | Simplified domain model: main classes, key attributes, multiplicities, embedded parts as composition |
| [architecture.md](architecture.md) | Architecture | The Docker Compose services, backend processes, MongoDB and external services |

The plan these diagrams were built from is in [PLAN.md](PLAN.md). For the job state machine, the API surface and other detail, see [../system-architecture.md](../system-architecture.md).

**Render check:** `npx -y @mermaid-js/mermaid-cli -i docs/diagrams/<file>.md -o /tmp/out.md`
