# Planetnik CLI Reference

Planetnik is a source code analysis tool. The CLI provides commands to initialize configuration, analyze repositories, extract git history, and generate reports.

## Installation

```bash
bun install
```

## Usage

```bash
bun run apps/cli/src/index.ts <command> [options]
```

All commands support `--help` for detailed option descriptions.

### Standalone executable

The CLI can be packaged as a self-contained Bun executable for CI or local
distribution:

```bash
bun run --cwd apps/cli compile
./apps/cli/dist/planetnik --help
```

Run the local packaging contract smoke (compile, help parsing, and a temporary
Python report) with:

```bash
bun run --cwd apps/cli compile:smoke
```

The smoke intentionally uses a temporary fixture and does not contact GitHub.

---

## Commands

### `analyzeRemote`

**One-command analysis of any remote git repository.** Clones the repo, initializes configuration, extracts git history, runs analysis, and generates reports — all in a single step.

```bash
# GitHub shorthand
planetnik analyzeRemote --repo facebook/react

# Full URL
planetnik analyzeRemote --repo https://github.com/facebook/react.git

# With options
planetnik analyzeRemote --repo facebook/react --ref main --name "React" --outputFolder ./datasets/react

# Keep the cloned repo for inspection
planetnik analyzeRemote --repo facebook/react --keep
```

| Option | Default | Description |
|--------|---------|-------------|
| `--repo` | *(required)* | Git URL or `owner/repo` GitHub shorthand |
| `--ref` | `main` | Branch, tag, or commit to analyze |
| `--outputFolder` | `./planetnik-report` | Where to write reports and data |
| `--name` | *(auto-detected)* | Project name override |
| `--keep` | `false` | Keep cloned repository after analysis |
| `--emitLegacyProjections` | *(off)* | Also emit legacy TXT projections and HTML reports |

The command outputs a `data/` subdirectory in the output folder, which can be consumed by the Astro site via `PLANETNIK_DATA_DIR`.

---

### `analyzeLandscape`

**Multi-repository landscape analysis.** Discovers all repos in one or more GitHub organizations, clones and analyzes each, then aggregates results into a landscape report showing cross-repo metrics, contributors, languages, and team topology.

This replaces the Java-era `sokrates-oss-landscape-analysis` pipeline (which required JVM + Node.js + bash scripts) with a single command.

Dependency security is collected here too. It is not a second command. If you want the `landscape/security` page to be populated, run `analyzeLandscape` with:

- a GitHub token available as `GITHUB_TOKEN` or `githubToken`
- `security.enabled: true`
- `security.fetchAlerts: true`

`updateLandscape` regenerates landscape contracts from existing repo analyses, but it does not fetch Dependabot alerts.

```bash
# Analyze all active repos in a GitHub org
planetnik analyzeLandscape --config ./landscape-config.json

# With options
planetnik analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./datasets/my-landscape \
  --name "Platform Landscape" \
  --concurrency 8

# Restore the legacy landscape TXT and HTML projections when needed
planetnik analyzeLandscape \
  --config ./landscape-config.json \
  --emitLegacyProjections

# Re-run — only analyzes new/changed repos
planetnik analyzeLandscape --config ./landscape-config.json --skipExisting

# With dependency security enabled from env
export GITHUB_TOKEN=YOUR_TOKEN_WITH_SECURITY_EVENTS_SCOPE
planetnik analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./datasets/alanpcurrie \
  --name "alanpcurrie Landscape"
```

For local development, prefer an env file over exporting each time:

```bash
cp apps/cli/.env.example apps/cli/.env
```

```env
GITHUB_TOKEN=YOUR_TOKEN_WITH_SECURITY_EVENTS_SCOPE
```

Then run the CLI through the app cwd so that env file is picked up:

```bash
bun run --cwd apps/cli dev analyzeLandscape --config ../../landscape-config.json --outputFolder ../../datasets/alanpcurrie --name "alanpcurrie Landscape"
```

| Option | Default | Description |
|--------|---------|-------------|
| `--config` | *(required)* | Path to landscape config JSON (see below) |
| `--outputFolder` | `./landscape-report` | Root output folder |
| `--name` | *(auto)* | Landscape name override |
| `--concurrency` | `4` | Parallel repo analysis |
| `--skipExisting` | `true` | Skip repos with existing `analysisResults.json` |
| `--emitLegacyProjections` | *(off)* | Also emit landscape TXT projections and the legacy HTML overview |

**Config format** (`landscape-config.json`):

```json
{
  "githubCloneUrl": "https://github.com",
  "githubApiUrl": "https://api.github.com",
  "githubToken": "<YOUR_TOKEN or omit and set GITHUB_TOKEN env var>",
  "reposUpdatedAfter": "2023-01-01",
  "security": {
    "enabled": true,
    "fetchAlerts": true,
    "fetchSBOM": false
  },
  "emitLegacyProjections": false,
  "githubOrgs": ["my-org"],
  "ignore": [
    { "org": "", "repo": ".*[-]builds" }
  ]
}
```

For GitHub security data, the token must be able to read Dependabot alerts. The site message refers to `security_events` scope because that is the key permission required by the Dependabot alerts API. If no token is available, the CLI skips the security phase and no `landscape_dependency_*.json` files are written. If the token is invalid or cannot read Dependabot alerts, the CLI now logs an explicit warning instead of silently producing an empty security view.

**Output structure:**

```
landscape-report/
  _discovery/                    # Raw GitHub API results
    my-org.json
  my-org/                        # Per-repo analysis results
    repo-a/
      data/analysisResults.json
      html/...                    # only with emitLegacyProjections: true
    repo-b/
      data/analysisResults.json
      html/...                    # only with emitLegacyProjections: true
  _planetnik_landscape/
    config.json                  # Auto-generated landscape config
    reports/
      index.html                 # Optional legacy landscape overview (--emitLegacyProjections)
      data/
        landscapeAnalysisResults.json
        landscape_dependency_alerts.json   # present only when security alerts were fetched
        landscape_dependency_health.json   # present only when security alerts were fetched
  _failures.json                 # Failed repos (if any)
```

---

### `init`

Initialize a Planetnik configuration for a local source directory. Scans the directory for source files, detects languages, and creates a `_planetnik/config.json`.

```bash
planetnik init --srcRoot /path/to/project
planetnik init --srcRoot . --name "My Project" --description "A web app"
```

| Option | Default | Description |
|--------|---------|-------------|
| `--srcRoot` | `.` | Root directory of the source code |
| `--name` | *(from directory)* | Project name |
| `--description` | *(empty)* | Project description |
| `--logoLink` | *(empty)* | URL to project logo |
| `--confFile` | *(auto)* | Custom path for config file |

---

### `extractGitHistory`

Extract git commit history into a flat `git-history.txt` file. This is required before generating reports that include contributor, commit, and temporal dependency analysis.

```bash
planetnik extractGitHistory --srcRoot /path/to/project
```

| Option | Default | Description |
|--------|---------|-------------|
| `--srcRoot` | `.` | Root of the git repository |

Output format (one line per file change):
```
2024-03-10 user@example.com abc123 src/file.ts
```

---

### `generateReports`

Run the full analysis pipeline on an already-initialized project and generate
canonical JSON data exports. Legacy TXT projections and Sokrates-era HTML
reports are available as an explicit opt-in.

```bash
planetnik generateReports --confFile /path/to/_planetnik/config.json
planetnik generateReports --confFile ./config.json --outputFolder ./reports
planetnik generateReports --confFile ./config.json --emitLegacyProjections
planetnik generateReports --confFile ./config.json --outputFolder ./datasets/requests/data --retainSnapshots 3
```

| Option | Default | Description |
|--------|---------|-------------|
| `--confFile` | `_planetnik/config.json` | Path to configuration file |
| `--outputFolder` | `_planetnik/reports` | Output directory for reports |
| `--emitLegacyProjections` | *(off)* | Also emit legacy TXT projections and HTML reports |
| `--retainSnapshots` | *(off)* | Retain up to N canonical snapshots, including the current export |

Generates:
- `data/` — canonical JSON exports (consumed by the Astro site)
- `html/` and `index.html` — only when legacy projections are enabled

Optional config fields:

- `findingsPath` — relative path from the config file to the canonical structured findings JSON. If omitted, `findings.json` beside the config is used when present. Each item requires a stable `id`, `summary`, and Markdown/plain-text `body`.
- When `emitLegacyProjections` is enabled, the legacy findings HTML report is derived from the canonical findings JSON; HTML fragments are no longer accepted as input.
- `emitLegacyProjections` — set to `true` to emit legacy TXT projections and HTML reports. The default is `false`; the CLI flag overrides the config value when supplied.
- `retainSnapshots` — set to an integer of at least `2` to archive the previous canonical snapshot before each export, write a portable `data/snapshot-history.json` manifest after a successful export, and prune older archives. Only the `report_context.json` file and declared canonical JSON shards are retained; TXT and HTML projections are never copied.

Example:

```json
{
  "findingsPath": "findings.json",
  "emitLegacyProjections": false,
  "retainSnapshots": 3
}
```

Retention is deliberately opt-in so ordinary report generation remains a
single current snapshot. On the first retained export the manifest contains
only `dataDir: "."`; the second and later exports add archives beneath
`history/<snapshotId>` and keep the newest N snapshots in total. If an export
fails after rotation begins, the interim manifest omits the current entry so
readers fail closed instead of treating a partial write as a valid trend.

Canonical `findings.json` example:

```json
{
  "title": "Notes & Findings",
  "items": [
    {
      "id": "validation-gap",
      "summary": "Validation gap",
      "body": "**Checkout** skips validation in one path.\n\nReview the fallback."
    }
  ]
}
```

---

### `extractGitSubHistory`

Extract git history for a subdirectory of a repository. Useful for monorepo analysis where each package needs its own history.

```bash
planetnik extractGitSubHistory --analysisRoot /path/to/monorepo --prefix packages/core
```

| Option | Default | Description |
|--------|---------|-------------|
| `--analysisRoot` | `.` | Root of the repository |
| `--prefix` | *(required)* | Subdirectory path prefix to filter |

---

### `extractFiles`

Extract files matching a regex pattern from a source directory into a destination folder, preserving directory structure. Also filters matching entries from `git-history.txt`.

```bash
planetnik extractFiles --analysisRoot . --pattern "\.tsx?$" --destFolder ./ts-files
```

| Option | Default | Description |
|--------|---------|-------------|
| `--analysisRoot` | `.` | Root directory to scan |
| `--pattern` | *(required)* | Regex pattern to match file paths |
| `--destFolder` | *(required)* | Destination directory |

---

### `updateConfig`

Modify an existing Planetnik configuration without reinitializing.

```bash
planetnik updateConfig --srcRoot . --setName "New Name"
planetnik updateConfig --confFile ./config.json --skipDuplication
planetnik updateConfig --confFile ./config.json --enableDuplication
```

| Option | Default | Description |
|--------|---------|-------------|
| `--srcRoot` | `.` | Source root directory |
| `--confFile` | *(auto)* | Path to config file |
| `--setName` | *(unchanged)* | Update project name |
| `--setDescription` | *(unchanged)* | Update description |
| `--setLogoLink` | *(unchanged)* | Update logo link |
| `--skipDuplication` | `false` | Disable duplication analysis |
| `--enableDuplication` | `false` | Enable duplication analysis |

---

### `updateLandscape`

Regenerate canonical landscape JSON from multiple repository analyses in a directory. The legacy landscape HTML report and TXT projections are opt-in.

```bash
planetnik updateLandscape --analysisRoot /path/to/repos
planetnik updateLandscape --analysisRoot . --name "Platform Landscape"
planetnik updateLandscape --analysisRoot . --emitLegacyProjections
```

| Option | Default | Description |
|--------|---------|-------------|
| `--analysisRoot` | `.` | Root directory containing repositories |
| `--confFile` | *(auto)* | Landscape configuration file |
| `--name` | *(auto)* | Landscape name |
| `--description` | *(empty)* | Landscape description |
| `--emitLegacyProjections` | *(off)* | Also emit landscape TXT projections and the legacy HTML overview |

`updateLandscape` rebuilds canonical landscape JSON from an existing analysis root. Pass `--emitLegacyProjections` (or set `emitLegacyProjections: true` in the landscape config) to restore the legacy HTML overview and TXT projections. It does not perform GitHub discovery, clone repositories, or fetch Dependabot alerts.

---

### `exportConventions`

Export the standard analysis conventions (test files, generated files, build files, ignored patterns) to `standard_analysis_conventions.json`.

```bash
planetnik exportConventions
```

No options. Writes to the current directory.

---

### `initConventions`

Create an empty `analysis_conventions.json` template for defining custom analysis conventions.

```bash
planetnik initConventions
```

No options. Writes to the current directory.

---

## Typical Workflows

### Analyze a remote repository (simplest)

```bash
planetnik analyzeRemote --repo owner/repo --outputFolder ./datasets/report
```

### Analyze a local repository

```bash
cd /path/to/project
planetnik init
planetnik extractGitHistory
planetnik generateReports
```

### Build the Astro site from analysis data

```bash
# After generating reports (either method)
PLANETNIK_DATA_DIR=./datasets/report/data bun run --cwd apps/site build

# Or for dev mode
PLANETNIK_DATA_DIR=./datasets/report/data bun run --cwd apps/site dev
```

For local developer-specific defaults, prefer `apps/site/.env.local`:

```env
# Recommended local workflow: select a named dataset under the repo-root datasets/ folder.
PLANETNIK_DATASETS_ROOT=/Users/alan/Projects/planetnik/datasets
PLANETNIK_DATASET=effect-ts

# Raw overrides still work when needed.
PLANETNIK_DATA_DIR=/absolute/path/to/report/data
PLANETNIK_LANDSCAPE_DATA_DIR=/absolute/path/to/_planetnik_landscape/reports/data
```

### View the validated `Effect-TS` landscape in Astro dev

If you want to inspect the real remote landscape dataset validated during development, use the generated `Effect-TS` landscape output directly:

```bash
cd /Users/alan/Projects/planetnik/apps/site
PLANETNIK_LANDSCAPE_DATA_DIR=/Users/alan/Projects/planetnik/datasets/effect-ts/_planetnik_landscape/reports/data bun run dev
```

That assumes you generated the landscape into `./datasets/effect-ts`.

Then open:

- `http://localhost:4321/landscape`
- `http://localhost:4321/landscape/repositories`
- `http://localhost:4321/landscape/contributors`
- `http://localhost:4321/landscape/teams`
- `http://localhost:4321/landscape/topology`
- `http://localhost:4321/landscape/tags`

Useful validation commands against the same dataset:

```bash
cd /Users/alan/Projects/planetnik/apps/site
PLANETNIK_LANDSCAPE_DATA_DIR=/Users/alan/Projects/planetnik/datasets/effect-ts/_planetnik_landscape/reports/data bun run typecheck
PLANETNIK_LANDSCAPE_DATA_DIR=/Users/alan/Projects/planetnik/datasets/effect-ts/_planetnik_landscape/reports/data bun run build
```

Notes:

- The site reads `report_context.json` and switches into landscape mode automatically.
- In landscape mode, root single-repo routes such as `/contributors` and `/topology` redirect to their `/landscape/*` equivalents.
- In this environment, running from `apps/site` directly was more reliable than repo-root filtered commands for landscape mode. Prefer the direct `cd apps/site && bun run ...` form until that is reviewed.

### Deploy to GitHub Pages

The included GitHub Actions workflow ([deploy.yml](/Users/alan/Projects/planetnik/.github/workflows/deploy.yml)) automates the full pipeline:

1. Trigger manually via `workflow_dispatch` with a `repo` input
2. Or push to `main` to analyze the repository itself
3. The workflow runs `analyzeRemote`, builds the Astro site, and deploys to GitHub Pages

For the Diátaxis deployment set, see:

- [`docs/deployment.md`](/Users/alan/Projects/planetnik/docs/deployment.md)
- [`docs/deployment/reference-github-actions-deployment.md`](/Users/alan/Projects/planetnik/docs/deployment/reference-github-actions-deployment.md)

```yaml
# Manual trigger example — analyze React
repo: facebook/react
ref: main
name: React
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PLANETNIK_DATASETS_ROOT` | Optional root directory for named local datasets. Defaults to `<repo>/datasets` when `PLANETNIK_DATASET` is used. |
| `PLANETNIK_DATASET` | Optional named local dataset selector. The site looks for a matching dataset under `PLANETNIK_DATASETS_ROOT` before falling back to the default single-repo path. |
| `PLANETNIK_DATA_DIR` | Path to the `data/` directory from a report run. Used by the Astro site and content loaders to find analysis results. |
| `PLANETNIK_LANDSCAPE_DATA_DIR` | Optional landscape-specific data directory. Used when `PLANETNIK_DATA_DIR` is not set. Useful for keeping a single-repo default and a separate multi-repo landscape dataset side by side. |

---

## Output Structure

After analysis, the output folder contains:

```
report/
  data/                   # Canonical machine-readable exports
    analysisResults.json   # Full analysis summary
    files_main.json        # Main source files
    files_test.json        # Test files
    units.json             # Functions/methods
    duplicates.json        # Duplicate code blocks
    metrics.json           # Key-value metrics
    contributors.json      # Contributor statistics
    controls.json           # Goals and controls
    temporal_dependencies.json
    ...
  html/                   # Optional legacy HTML reports (--emitLegacyProjections)
    SourceCodeOverview.html
    Components.html
    Contributors.html
    ...
  index.html              # Optional legacy report index
```

The `data/` directory is the bridge between the CLI analysis and the Astro frontend. Point `PLANETNIK_DATA_DIR` at it to build the static site. Legacy TXT projections are also emitted under `data/` only when `--emitLegacyProjections` (or `emitLegacyProjections: true` in the config) is enabled. Existing legacy files are preserved when an output folder is reused; use a fresh output folder when you need a physically JSON-only artifact set.
