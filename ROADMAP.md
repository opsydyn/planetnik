# Planetnik — Product Roadmap

## Vision

Planetnik reads the structural weather of codebases. Today it analyses coupling, complexity, hotspots, ownership, and churn. The roadmap extends this into live intelligence, dependency security, and cross-system integration — making Planetnik the single view of codebase health.

---

## Now — In Progress

### Intelligence: Server-Side Tools (ADR-0014, Phase 1)

CopilotKit runtime with server-side actions that give Planetnik direct access to the full analysis dataset. The agent can query any file, contributor, hotspot, or coupling relationship on demand — not just a pre-digested summary.

**Status:** Implementation complete, testing.

---

## Next

### Intelligence: Mastra Agent Backend (ADR-0014, Phase 2)

Migrate from CopilotKit runtime actions to a Mastra-powered agent. Adds agent orchestration, tool composition, and the foundation for RAG and memory. Blocked on `@ag-ui/mastra` stabilising its peer dependency on `@copilotkit/runtime`.

### Dependency Security Integration

**The supply chain weather layer.** Pull Dependabot alerts, SBOM data, and dependency graphs from the GitHub API. Combine with structural analysis to produce a unified health view.

**Data sources:**

- `GET /repos/{owner}/{repo}/dependabot/alerts` — CVEs, severity, affected packages, patch status
- `GET /repos/{owner}/{repo}/dependency-graph/sbom` — full SPDX dependency tree
- `GET /orgs/{org}/dependabot/alerts` — cross-repo vulnerability overview (landscape mode)

**New analysis outputs:**

- `dependency_alerts.json` — per-repo vulnerability alerts with severity, state, package, advisory
- `dependency_sbom.json` — full dependency graph in SPDX format
- `dependency_health.json` — aggregated metrics (alert counts by severity, mean-time-to-fix, patch lag)

**New report pages:**

- `/dependencies/security` — vulnerability dashboard: severity breakdown, open/fixed trends, patch lag
- `/dependencies/graph` — visual dependency tree (Sigma/graphology reuse)
- Landscape: `/landscape/security` — cross-repo vulnerability heatmap

**Weather metaphor extensions:**

- Vulnerability pressure — critical/high CVEs are incoming storms
- Dependency fog — transitive deps nobody monitors
- Patch lag — how long alerts stay open (staleness = risk accumulation)
- Supply chain exposure — shared vulnerable deps across repos (landscape)

**Requirements:**

- `GITHUB_TOKEN` with `security_events` scope (or fine-grained vulnerability alerts permission)
- Repository GitHub URL (from git remote, config, or env var)
- No new package dependencies — `fetch()` or `gh` CLI

**Intelligence integration:** New server-side tools for Planetnik to query — "which repos have critical vulnerabilities?", "what's our mean patch lag?", "show supply chain exposure for lodash".

### Intelligence: RAG + Memory (ADR-0014, Phase 3)

Embed full analysis output into a vector store for semantic search. Add session memory for conversation continuity. Enables fuzzy questions and cross-dimension queries without exhaustive tool calls.

### Canonical Report Contracts + AI-Ready Analysis Data

Retire Sokrates-era text and HTML artifacts as the primary reporting contract. Define a versioned minimum JSON snapshot model, keep TXT/HTML as optional compatibility or debug projections, and use the same canonical snapshot as the foundation for Tree-sitter-powered extraction improvements and hosted semantic retrieval over Neon/`pgvector`.

See [docs/report-data-modernization-roadmap.md](docs/report-data-modernization-roadmap.md).

---

## Later

### Multi-Agent Specialist Network

Specialist sub-agents for complexity, coupling, ownership, churn, and dependency security. A triage agent delegates to specialists and synthesises investigation reports. Mastra workflows for multi-step diagnostics ("diagnose this module").

### Tree-sitter Language Expansion (ADR-0009)

Extend the Tree-sitter pilot (Rust) to additional languages. Priority: Go, Python, Java. Improves unit extraction, complexity measurement, and dependency analysis accuracy.

### CI/CD Integration

GitHub Action that runs Planetnik analysis on PR and comments with a structural diff — "this PR increases coupling pressure in module X by 15%". Pairs with dependency security to flag PRs that introduce vulnerable deps.

### Trend Forecasting

Use historical analysis snapshots to predict where structural pressure is building. "At current churn rate, this module will reach critical hotspot status in ~6 weeks."

---

## Completed

### Core Backend Parity

100% feature parity with Java Sokrates on the analysis engine. 501 tests, 1194 assertions. See [TODO.md](TODO.md).

### Astro Report Site

Full interactive report site with visx charts, Sigma force-directed graphs, React Flow diagrams, TanStack tables. Landscape mode for multi-repo organisations.

### Intelligence: Chat Interface (ADR-0013, Phase 1-1.5)

CopilotKit-powered conversational interface with Planetnik persona, inline chart generation, page navigation actions, and contextual follow-up suggestions.
