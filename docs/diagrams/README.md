# Diagrams

These are the TORPulse system diagrams, written in Mermaid so that GitHub and the VSCode markdown preview render them. They were traced from the code as of 2026-11-08 and simplified on 2026-11-16 to show only the main parts. The earlier, fully detailed versions are in git history (commit 24cc306).

| Diagram | Type | What it shows |
|---|---|---|
| [ingestion-sequence.md](ingestion-sequence.md) | Sequence | Discovery by the queue producer and processing by the ingestion worker (main path) |
| [tor-ai-flow.md](tor-ai-flow.md) | Flowchart ×2 | How TOR data flows from source to screen, and the AI qualification-match workflow through to email notifications |
| [er-diagram.md](er-diagram.md) | ER | All 14 MongoDB collections with their keys and relations |
| [class-diagram.md](class-diagram.md) | Class | Core domain model: bidder, TOR and how matches link them |
| [architecture.md](architecture.md) | Architecture | The Docker Compose services, backend processes, MongoDB and external services |
| [state-machines.md](state-machines.md) | State ×4 | The status life cycle of each worker (producer, ingestion, qualification, notification), plus gaps found |

The plan these diagrams were built from is in [PLAN.md](PLAN.md). For the API surface and other detail, see [../system-architecture.md](../system-architecture.md).

**Render check:** `npx -y @mermaid-js/mermaid-cli -i docs/diagrams/<file>.md -o /tmp/out.md`
