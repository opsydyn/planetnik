# ADR-0013: Adopt CopilotKit for Intelligence View

## Status

Proposed

## Context

Planetnik produces rich structural analysis — coupling, complexity, hotspots, impact, entropy, ownership — but the output is static. Users navigate pre-rendered pages and interpret charts manually. There is no way to ask questions about the data, drill into relationships across dimensions, or generate ad-hoc visualisations from the analysis output.

The natural next step is an **Intelligence view**: a conversational interface where users can query the underlying analysis data in real time, receive on-demand charts and data visualisations, and explore the codebase weather system interactively — "which components have the highest coupling pressure?", "show me a chart of complexity vs churn for the top 20 hotspots", "what changed most in the last quarter?".

This requires three capabilities the current stack does not provide:

1. **Chat interface** — a conversational UI embedded in the Astro report site
2. **Data-aware agent** — an LLM with access to the analysis schema and exported JSON data
3. **Generative UI** — the ability for the agent to render React components (charts, tables, diagrams) dynamically in the conversation, not just text responses

[CopilotKit](https://docs.copilotkit.ai/) is an open-source framework designed for exactly this pattern. It provides React-based chat components, an agent runtime, and a generative UI system (A2UI) that allows agents to render interactive React components directly in the chat stream.

## Decision

We will adopt CopilotKit as the framework for the Intelligence view, integrated into the Astro report site as a React island.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Astro Report Site                              │
│  ┌───────────────────────────────────────────┐  │
│  │  /intelligence (Astro page)               │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │  <CopilotKit> React Island          │  │  │
│  │  │  ┌───────────────┐ ┌─────────────┐  │  │  │
│  │  │  │ CopilotChat   │ │ Generative  │  │  │  │
│  │  │  │ (sidebar/     │ │ UI panels   │  │  │  │
│  │  │  │  popup)       │ │ (charts,    │  │  │  │
│  │  │  │               │ │  tables,    │  │  │  │
│  │  │  │               │ │  diagrams)  │  │  │  │
│  │  │  └───────────────┘ └─────────────┘  │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────┘  │
│                        │                        │
│                        ▼                        │
│              Copilot Runtime (self-hosted)       │
│              ┌─────────────────────────────┐    │
│              │  Analysis data context       │    │
│              │  (JSON exports as tool args) │    │
│              │  Schema definitions          │    │
│              │  LLM provider (configurable) │    │
│              └─────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Key integration points

**Frontend — React island in Astro:**

- `@copilotkit/react-core` — `CopilotKit` provider, hooks (`useCopilotReadable`, `useCopilotAction`)
- `@copilotkit/react-ui` — `CopilotChat`, `CopilotSidebar`, or `CopilotPopup` component
- Rendered as an Astro React island with `client:load` — same pattern as existing visx/Sigma/TanStack islands
- Reuses existing chart components (visx, Sigma.js, React Flow, TanStack Table) as generative UI targets

**Generative UI — A2UI:**

- Agent can render Planetnik's existing React chart components directly in the conversation
- Interactive components allow users to refine queries by interacting with generated visualisations
- Components registered via CopilotKit's component system, not reimplemented for the chat context
- Example: agent generates a hotspot bar chart, user clicks a bar to drill into that component's coupling graph

**Data context — analysis exports as readable state:**

- `useCopilotReadable` exposes analysis JSON (summary, repositories, coupling, hotspots, contributors, impact) to the agent
- The agent can query across dimensions: "show contributors who touched the most hotspots"
- Schema definitions from `@effect/schema` inform the agent about data shape and semantics
- Content collections already produce the JSON — no new export pipeline needed

**Agent runtime — self-hosted:**

- Self-hosted Copilot Runtime to avoid cloud dependency
- LLM provider configurable (Anthropic Claude preferred, OpenAI supported)
- Agent has tool access to query and filter analysis data
- No external service dependency beyond the LLM API key

### Phased rollout

**Phase 1 — Chat with data context (MVP)**

- Add `/intelligence` page with `CopilotChat` in a React island
- Expose analysis summary and repository data via `useCopilotReadable`
- Agent can answer questions about the analysis in natural language
- Text-only responses, no generative UI yet

**Phase 1.5 — Client-side generative UI (current)**

- Chart components (HorizontalBarChart, DonutChart, DistributionChart) registered as `useCopilotAction` tools with `render` functions (display-only pattern)
- LLM decides when to invoke a chart action based on the question and available data
- Charts render inline in the chat using existing visx components
- No server-side agent changes required — actions are client-side only

**Phase 2 — A2UI (Agent-to-UI) with server-side rendering**

- Migrate from client-side `useCopilotAction` to CopilotKit's [A2UI specification](https://docs.copilotkit.ai/generative-ui/a2ui) for server-driven UI
- Agent runtime declaratively describes which components to render — more flexible than client-side tool definitions
- Enables richer interactions: drill-down from chart elements, multi-step visualisation workflows
- Requires CoAgent setup (LangGraph or similar) on the runtime side
- Register additional chart components (treemaps, heatmaps, scatter plots, tables) as A2UI targets

**Phase 3 — Custom intelligence components**

- Purpose-built components for the intelligence view (comparison panels, trend charts, what-if scenarios)
- Cross-dimension queries: "overlay coupling pressure on the ownership heatmap"
- Report generation: agent produces exportable summaries from conversational exploration

### Dependencies

```
@copilotkit/react-core    — Provider, hooks, state management
@copilotkit/react-ui      — Chat UI components
```

These are added to `apps/site/package.json` alongside existing React dependencies. CopilotKit requires React 18+ (site uses React 19).

## Why this option

- **Reuses existing components** — Planetnik already has a rich library of React chart components (visx, Sigma.js, React Flow, TanStack Table). CopilotKit's A2UI lets the agent render these directly rather than building a parallel visualisation system.
- **Astro island compatible** — CopilotKit is a React library. The site already renders React islands for all interactive components. No architectural change needed.
- **Open source** — CopilotKit is MIT-licensed. Self-hosted runtime avoids vendor lock-in.
- **Generative UI is the differentiator** — most chat integrations produce text. A2UI produces interactive components. This turns the Intelligence view into a dynamic analysis workbench rather than a chatbot.
- **Data is already exported** — content collections and JSON exports provide all the data the agent needs. No new backend or API required for Phase 1.
- **Progressive adoption** — Phase 1 is a single page with a chat component. No changes to existing pages or build pipeline.

## Alternatives Considered

### Build a custom chat UI with direct LLM API calls

This avoids a dependency but requires implementing chat state management, streaming, tool calling, and generative UI rendering from scratch.

We are not choosing this because the implementation cost is high and CopilotKit solves exactly this problem as a maintained open-source library.

### Use Vercel AI SDK

The Vercel AI SDK provides streaming chat and tool calling but has weaker generative UI support and is more tightly coupled to the Vercel ecosystem.

We are not choosing this because CopilotKit's A2UI model — where the agent directly specifies which React component to render — is a better fit for Planetnik's existing component library.

### Embed a third-party AI chat widget

Services like Chatbase or CustomGPT provide hosted chat widgets but offer no control over data context, component rendering, or self-hosting.

We are not choosing this because the Intelligence view needs deep integration with Planetnik's data schema and visualisation components, not a generic chat overlay.

## Consequences

- A new `/intelligence` page will appear in the site navigation.
- Two new npm dependencies (`@copilotkit/react-core`, `@copilotkit/react-ui`) are added to the site.
- An LLM API key is required at build time or runtime for the intelligence feature to function. The rest of the site remains fully static and functional without it.
- Existing chart components gain a second rendering context (intelligence view) in addition to their static report pages.
- The self-hosted runtime needs a deployment target (could be a lightweight serverless function or a local process during development).

## Related ADRs

- ADR-0001: Effect TS with Bun Runtime
- ADR-0003: Backend-Only Parity, Astro Frontend
- ADR-0008: Adopt Sigma and Graphology for Force-Directed Parity Visualizations
