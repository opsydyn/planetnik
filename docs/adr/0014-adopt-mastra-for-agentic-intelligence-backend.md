# ADR-0014: Server-Side Intelligence Tools, Mastra Agent Backend

## Status

Proposed

## Context

ADR-0013 introduced CopilotKit for the Intelligence view. The current implementation (Phase 1.5) works: users can chat with Płanetnik, ask questions about hotspots and coupling, and receive inline charts via `useCopilotAction`. But the architecture has a ceiling.

Today's `apps/copilot-runtime` is a thin proxy — `CopilotRuntime` + `OpenAIAdapter` forwarding prompts to an LLM. All intelligence lives on the frontend: `useCopilotReadable` serializes a trimmed subset of analysis data into the prompt context, and the LLM reasons over whatever fits. This means:

1. **Context window is the bottleneck.** The agent can only see what the frontend pre-digests (top 20 hotspots, summary stats, top 15 impact opportunities). It cannot answer "show me all files touched by contributor X that are also high-complexity" because that requires the full dataset.

2. **No on-demand data access.** The LLM cannot pull additional data mid-conversation. If a user asks about a file not in the top 20, the agent has no way to look it up.

3. **No memory across sessions.** Each page load starts fresh. There is no way to say "continue investigating those coupling issues we discussed yesterday."

4. **No multi-step reasoning.** Complex questions like "why is this module degrading?" require pulling coupling data, churn history, contributor patterns, and synthesizing — a pipeline, not a single prompt.

5. **No server-side tools.** The runtime has no access to the analysis output files. All data must be serialized into the frontend and pushed into context.

[Mastra](https://mastra.ai/) is an open-source TypeScript framework for building AI agent backends. It provides agents, tools, workflows, RAG, and memory as composable primitives. It integrates with CopilotKit via the [AG-UI protocol](https://docs.ag-ui.com/) — the same protocol CopilotKit already speaks — so the frontend stays unchanged.

This is worth capturing as an ADR because:

- it replaces the runtime architecture from a stateless proxy to a stateful agent backend
- it introduces new dependencies (`@mastra/core`, `@ag-ui/mastra`) and a new execution model
- it is the foundation for features that differentiate Planetnik from static analysis tools
- it determines how deeply the "intelligence" layer can reason about analysis data

## Decision

We will adopt Mastra as the agent backend for the Intelligence view, replacing the current CopilotKit proxy runtime with a Mastra-powered agent that has direct access to analysis data via server-side tools.

### Architecture

```
┌──────────────────────────────────────────────────────┐
│  Astro Report Site (unchanged)                       │
│  ┌────────────────────────────────────────────────┐  │
│  │  <CopilotKit runtimeUrl="...">                 │  │
│  │    CopilotChat + useCopilotAction (charts)     │  │
│  │    useCopilotReadable (summary context)         │  │
│  └───────────────────┬────────────────────────────┘  │
│                      │ AG-UI protocol                │
│                      ▼                               │
│  ┌────────────────────────────────────────────────┐  │
│  │  Mastra Runtime (apps/copilot-runtime)         │  │
│  │  ┌──────────────────────────────────────────┐  │  │
│  │  │  Płanetnik Agent                         │  │  │
│  │  │  ┌────────────┐  ┌───────────────────┐   │  │  │
│  │  │  │ Tools:     │  │ Knowledge:        │   │  │  │
│  │  │  │ • hotspots │  │ • RAG over full   │   │  │  │
│  │  │  │ • coupling │  │   analysis output │   │  │  │
│  │  │  │ • files    │  │ • Vector store    │   │  │  │
│  │  │  │ • churn    │  │   (analysis data) │   │  │  │
│  │  │  │ • contrib  │  │                   │   │  │  │
│  │  │  └────────────┘  └───────────────────┘   │  │  │
│  │  │  ┌────────────┐  ┌───────────────────┐   │  │  │
│  │  │  │ Memory:    │  │ LLM:              │   │  │  │
│  │  │  │ • Session  │  │ • Configurable    │   │  │  │
│  │  │  │ • Cross-   │  │   (Claude, GPT)   │   │  │  │
│  │  │  │   session  │  │                   │   │  │  │
│  │  │  └────────────┘  └───────────────────┘   │  │  │
│  │  └──────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key integration points

**Mastra agent definition:**

A single `planetnik` agent with the Płanetnik persona, equipped with server-side tools that read analysis JSON directly from disk. The agent's `instructions` carry the weather-spirit persona and domain knowledge about code analysis metrics.

**Server-side tools:**

Tools are the core upgrade. Instead of the frontend pre-digesting data, the agent calls tools on demand:

| Tool | Input | What it does |
|---|---|---|
| `query-hotspots` | filters (severity, min score, file pattern) | Reads hotspots JSON, filters, returns matching entries |
| `query-coupling` | file or component name | Reads coupling data, returns related components and scores |
| `query-contributors` | contributor name or file pattern | Reads contributor data, returns ownership and churn metrics |
| `query-files` | path pattern, metric thresholds | Searches file-level metrics across the full analysis output |
| `query-churn` | file pattern, date range | Reads git history data, returns change frequency and recency |
| `query-impact` | dimension or component | Reads impact analysis, returns scores and opportunities |
| `get-summary` | — | Returns project summary (LOC, file count, duplication, etc.) |

Each tool reads from `PLANETNIK_DATA_DIR` — the same directory the Astro site reads during build. No new data pipeline needed.

**AG-UI protocol:**

Mastra speaks AG-UI natively. CopilotKit already speaks AG-UI on the frontend. The `registerCopilotKit` helper from `@ag-ui/mastra` wires them together. The frontend `runtimeUrl` points at the Mastra server instead of the current proxy — no frontend code changes required beyond the URL.

**RAG (Phase 2):**

Full analysis output (every file metric, every coupling edge, every contributor record) embedded into a vector store. This lets the agent answer fuzzy questions ("which areas feel neglected?") by retrieving semantically relevant records rather than scanning the full dataset with tools.

**Memory (Phase 2):**

Mastra's memory system stores conversation history per session. Enables "continue where we left off" and lets the agent build a mental model of what the user has already explored.

### Phased rollout

**Phase 1 — Server-side tools via CopilotKit actions (MVP, this iteration)**

- Keep `CopilotRuntime` + `OpenAIAdapter` as the HTTP layer
- Add server-side `actions` to the `CopilotRuntime` constructor — these are tool definitions with handlers that read analysis JSON from `PLANETNIK_DATA_DIR`
- Implement core tools: `queryHotspots`, `queryCoupling`, `getSummary`, `queryFiles`, `queryContributors`
- Each tool reads JSON from disk, filters/aggregates, and returns structured results
- Frontend unchanged — `useCopilotReadable` context provides the overview, server-side tools provide depth
- No new dependencies — CopilotKit runtime already supports server-side actions
- Result: Płanetnik can answer questions about any file, not just the pre-digested top N

**Phase 2 — Mastra agent backend**

- Migrate from CopilotKit runtime actions to Mastra `Agent` + `registerCopilotKit` via AG-UI protocol
- Requires `@ag-ui/mastra` to stabilize its peer dependency on `@copilotkit/runtime` (currently pins to a pre-release build)
- Mastra adds: agent orchestration, tool composition, structured memory, and the foundation for RAG
- The server-side tools from Phase 1 port directly to Mastra tool definitions

**Phase 3 — RAG + memory + multi-agent**

- Embed full analysis output into a vector store
- Add session memory for conversation continuity
- Specialist sub-agents for complexity, coupling, ownership, churn
- Mastra workflows for multi-step investigations ("diagnose this module")
- Result: deep, structured investigations that feel like a consultant's analysis

### Dependencies

Phase 1 adds no new dependencies — uses existing `@copilotkit/runtime` and `openai`.

Phase 2 will add:

```
@mastra/core          — Agent definition, tools, memory, RAG primitives
@ag-ui/mastra         — CopilotKit integration via AG-UI protocol
```

## Why this option

- **TypeScript-native.** Mastra is built in TypeScript for TypeScript developers. It fits the Planetnik stack (Bun, Effect, TS throughout) without introducing Python or YAML.
- **AG-UI is the bridge.** The frontend stays on CopilotKit with zero changes. AG-UI is the protocol both sides already speak. Mastra is the recommended backend for CopilotKit.
- **Tools unlock the full dataset.** The biggest limitation today — the context window bottleneck — is eliminated. The agent queries data on demand rather than stuffing everything into the prompt.
- **Progressive complexity.** Phase 1 is a modest refactor of the runtime. RAG and memory are opt-in additions, not architectural prerequisites.
- **Open source.** Mastra is MIT-licensed. No vendor lock-in. Self-hosted, same as the current runtime.

## Alternatives Considered

### Keep the current CopilotKit proxy and expand frontend context

Continue pushing more data into `useCopilotReadable`, increasing the trimmed subset sizes.

We are not choosing this because it hits a hard wall — context windows are finite and expensive. A 50k-file codebase cannot be summarized into a prompt. The agent needs on-demand data access, not larger upfront context.

### Build custom server-side tools without Mastra

Add tool handlers directly to the existing `CopilotRuntime` using CopilotKit's `actions` API on the runtime.

We are not choosing this because CopilotKit's runtime-side tool API is minimal — it's designed as a proxy, not an agent framework. Mastra provides agent orchestration, tool composition, memory, and RAG as maintained primitives. Reimplementing these on a bare runtime is unnecessary work.

### Use LangChain / LangGraph

LangChain provides agent orchestration and tool calling in Python (and JS via LangChain.js).

We are not choosing this because LangChain.js is less mature than the Python version, its abstractions are heavier than needed, and Mastra is specifically designed for the CopilotKit + AG-UI ecosystem. The integration path is shorter and the TypeScript ergonomics are better.

### Use Vercel AI SDK with server actions

The Vercel AI SDK supports tool calling and streaming via Next.js server actions.

We are not choosing this because the site is Astro (not Next.js), the runtime is Bun (not Node/Vercel), and the AI SDK does not provide agent orchestration, memory, or RAG primitives. It solves a narrower problem.

## Consequences

- `apps/copilot-runtime` changes from a CopilotKit proxy to a Mastra agent server. The package dependencies change but the external API (HTTP endpoint at `/api/copilotkit`) remains the same.
- The runtime gains read access to `PLANETNIK_DATA_DIR` and must be co-located with the analysis output (or have network access to it).
- Two new dependencies (`@mastra/core`, `@ag-ui/mastra`) are introduced. `@copilotkit/runtime` is removed.
- The agent can now answer questions about any entity in the analysis, not just the pre-digested summary. This changes the user experience from "chat about the overview" to "investigate anything."
- Future phases (RAG, memory, multi-agent) become incremental additions rather than architectural changes.

## Related ADRs

- ADR-0013: Adopt CopilotKit for Intelligence View (this supersedes its Phase 2 plan)
- ADR-0001: Effect TS with Bun Runtime
- ADR-0003: Backend-Only Parity, Astro Frontend
