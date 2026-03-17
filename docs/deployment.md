# Deployment Guide

Planetnik generates static sites from source code analysis. No JVM, no runtime server — just Bun, Astro, and GitHub Pages.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  GitHub Actions                                 │
│                                                 │
│  ┌──────────┐   ┌──────────┐   ┌────────────┐  │
│  │ Clone    │──▶│ Analyze  │──▶│ Build Astro│  │
│  │ target   │   │ (Bun CLI)│   │ static site│  │
│  └──────────┘   └──────────┘   └────────────┘  │
│                      │                │         │
│                      ▼                ▼         │
│                  data/*.json     dist/*.html    │
│                                       │         │
│                                       ▼         │
│                              GitHub Pages       │
└─────────────────────────────────────────────────┘
```

The pipeline has three stages:

1. **Analyze** — `analyzeRemote` clones a repo, runs the analysis engine, and outputs JSON/text data
2. **Build** — Astro's content loader reads the data directory and builds a static site
3. **Deploy** — GitHub Pages serves the static HTML

No runtime dependencies. No database. No server.

## GitHub Pages Setup

### 1. Enable GitHub Pages

In your Planetnik repository settings:

1. Go to **Settings → Pages**
2. Set **Source** to **GitHub Actions**

### 2. The workflow

The workflow at `.github/workflows/analyze-and-deploy.yml` handles everything.

**Automatic** — push to `main` to analyze the Planetnik repo itself:

```yaml
on:
  push:
    branches: [main]
```

**Manual** — trigger via GitHub UI or CLI to analyze any public repo:

```bash
gh workflow run "Analyze & Deploy" \
  -f repo=facebook/react \
  -f ref=main \
  -f name=React
```

### 3. Workflow inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `repo` | No | current repo | `owner/name` or full git URL |
| `ref` | No | `main` | Branch, tag, or commit |
| `name` | No | auto-detected | Project name for reports |

### 4. What happens

```
1. Checkout Planetnik source
2. Setup Bun
3. bun install
4. analyzeRemote --repo <target> --outputFolder _reports
5. PLANETNIK_DATA_DIR=_reports/data bun run build (Astro)
6. Upload dist/ as Pages artifact
7. Deploy to GitHub Pages
```

Total: ~2-5 minutes depending on target repo size.

## Local Development

### Analyze and preview locally

```bash
# Analyze a remote repo
bun run apps/cli/src/index.ts analyzeRemote \
  --repo owner/repo \
  --outputFolder ./my-report

# Start the Astro dev server with that data
PLANETNIK_DATA_DIR=./my-report/data bun run --cwd apps/site dev
```

### Use a local repo

```bash
# Init + extract + generate
bun run apps/cli/src/index.ts init --srcRoot /path/to/project
bun run apps/cli/src/index.ts extractGitHistory --srcRoot /path/to/project
bun run apps/cli/src/index.ts generateReports \
  --confFile /path/to/project/_planetnik/config.json \
  --outputFolder ./my-report

# Dev server
PLANETNIK_DATA_DIR=./my-report/data bun run --cwd apps/site dev
```

### Dev data setup

Create `apps/site/.env.local` to avoid typing the env var each time:

```env
# Prefer an absolute path to avoid cwd ambiguity
PLANETNIK_DATA_DIR=/absolute/path/to/report/data
```

The site reads this file using Astro/Vite-style env loading.

## Analyzing Private Repositories

### In GitHub Actions

For private repos in the same org, add a `token` to the checkout step. Fork the workflow and modify the `Analyze repository` step:

```yaml
- name: Analyze repository
  env:
    GIT_TOKEN: ${{ secrets.REPO_ACCESS_TOKEN }}
  run: |
    bun run apps/cli/src/index.ts analyzeRemote \
      --repo https://${GIT_TOKEN}@github.com/owner/private-repo.git \
      --outputFolder _reports
```

### Locally

Private repos work out of the box if your local git credentials have access:

```bash
bun run apps/cli/src/index.ts analyzeRemote --repo git@github.com:owner/private-repo.git
```

## Scheduled Analysis

Add a cron trigger to the workflow for regular re-analysis:

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'  # Every Monday at 06:00 UTC
  workflow_dispatch:
    inputs:
      repo:
        description: "Repository to analyze"
        required: false
        type: string
```

## Landscape Analysis (Multi-Repository)

The `analyzeLandscape` command replaces the Java-era `sokrates-oss-landscape-analysis` pipeline. It discovers all repos in GitHub org(s), analyzes each, and generates a landscape overview — no JVM, no bash scripts, no Node.js scripts.

### Setup

1. Copy `landscape-config.example.json` to `landscape-config.json`
2. Add your GitHub token and org name(s)
3. Set `reposUpdatedAfter` to filter inactive repos

### Run locally

```bash
bun run apps/cli/src/index.ts analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./my-landscape \
  --name "My Org Landscape"
```

### Run via GitHub Actions

The `landscape.yml` workflow automates this:

```bash
gh workflow run "Landscape Analysis" \
  -f config=landscape-config.json \
  -f name="My Org Landscape" \
  -f concurrency=8
```

It runs weekly by default (Monday 06:00 UTC) and deploys to GitHub Pages.

### Incremental analysis

By default, `--skipExisting` is enabled. Re-running the command only analyzes repos that don't already have results. To force re-analysis of everything, pass `--no-skipExisting` or delete the output folder.

### What it replaces

| Java Sokrates pipeline | Planetnik |
|------------------------|-----------|
| `get-repos.js` (Node.js) | Built-in GitHub API discovery |
| `generate-sh-scripts.js` (Node.js) | Not needed — no bash scripts |
| `clone-and-zip.sh` (bash) | Built-in clone + analyze |
| `run-analysis-from-zip.sh` (bash + JVM) | Built-in analysis (Bun) |
| `sokrates updateLandscape` (JVM) | Built-in landscape aggregation |
| Java + Node.js + bash + Graphviz | Just Bun |

## Multiple Repositories (Individual)

To analyze several repos individually and deploy as separate sites, use a matrix workflow:

```yaml
jobs:
  analyze:
    strategy:
      matrix:
        repo:
          - { name: "api", repo: "org/api", ref: "main" }
          - { name: "web", repo: "org/web", ref: "main" }
          - { name: "mobile", repo: "org/mobile", ref: "main" }
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: |
          bun run apps/cli/src/index.ts analyzeRemote \
            --repo ${{ matrix.repo.repo }} \
            --ref ${{ matrix.repo.ref }} \
            --name ${{ matrix.repo.name }} \
            --outputFolder _reports/${{ matrix.repo.name }}
```

## Troubleshooting

### "Data directory not found"
The Astro content loader can't find analysis results. Set `PLANETNIK_DATA_DIR` to the absolute path of the `data/` directory from your report output.

### "Clone failed"
The target repository may be private or the ref may not exist. Check:
- The repo is accessible (public, or credentials configured)
- The `--ref` branch/tag exists

### Empty reports
Run `extractGitHistory` before `generateReports` if using the step-by-step approach. The `analyzeRemote` command handles this automatically.

### Build warnings about empty collections
Some collections (dependencies, temporal deps) may be empty for small repos. This is normal — the pages render gracefully with no data.
