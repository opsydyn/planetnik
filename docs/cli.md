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
planetnik analyzeRemote --repo facebook/react --ref main --name "React" --outputFolder ./react-report

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

The command outputs a `data/` subdirectory in the output folder, which can be consumed by the Astro site via `PLANETNIK_DATA_DIR`.

---

### `analyzeLandscape`

**Multi-repository landscape analysis.** Discovers all repos in one or more GitHub organizations, clones and analyzes each, then aggregates results into a landscape report showing cross-repo metrics, contributors, languages, and team topology.

This replaces the Java-era `sokrates-oss-landscape-analysis` pipeline (which required JVM + Node.js + bash scripts) with a single command.

```bash
# Analyze all active repos in a GitHub org
planetnik analyzeLandscape --config ./landscape-config.json

# With options
planetnik analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./my-landscape \
  --name "Platform Landscape" \
  --concurrency 8

# Re-run — only analyzes new/changed repos
planetnik analyzeLandscape --config ./landscape-config.json --skipExisting
```

| Option | Default | Description |
|--------|---------|-------------|
| `--config` | *(required)* | Path to landscape config JSON (see below) |
| `--outputFolder` | `./landscape-report` | Root output folder |
| `--name` | *(auto)* | Landscape name override |
| `--concurrency` | `4` | Parallel repo analysis |
| `--skipExisting` | `true` | Skip repos with existing `analysisResults.json` |

**Config format** (`landscape-config.json`):

```json
{
  "githubCloneUrl": "https://github.com",
  "githubApiUrl": "https://api.github.com",
  "githubToken": "<YOUR_TOKEN>",
  "reposUpdatedAfter": "2023-01-01",
  "githubOrgs": ["my-org"],
  "ignore": [
    { "org": "", "repo": ".*[-]builds" }
  ]
}
```

**Output structure:**

```
landscape-report/
  _discovery/                    # Raw GitHub API results
    my-org.json
  my-org/                        # Per-repo analysis results
    repo-a/
      data/analysisResults.json
      html/...
    repo-b/
      data/analysisResults.json
      html/...
  _planetnik_landscape/
    config.json                  # Auto-generated landscape config
    reports/
      index.html                 # Landscape overview report
      data/
        landscapeAnalysisResults.json
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

Run the full analysis pipeline on an already-initialized project and generate HTML reports and data exports.

```bash
planetnik generateReports --confFile /path/to/_planetnik/config.json
planetnik generateReports --confFile ./config.json --outputFolder ./reports
```

| Option | Default | Description |
|--------|---------|-------------|
| `--confFile` | `_planetnik/config.json` | Path to configuration file |
| `--outputFolder` | `_planetnik/reports` | Output directory for reports |

Generates:
- `html/` — standalone HTML report pages
- `data/` — JSON and text data exports (consumed by the Astro site)
- `index.html` — report index page

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

Run landscape analysis across multiple repositories in a directory. Generates a landscape HTML report showing cross-repository metrics.

```bash
planetnik updateLandscape --analysisRoot /path/to/repos
planetnik updateLandscape --analysisRoot . --name "Platform Landscape"
```

| Option | Default | Description |
|--------|---------|-------------|
| `--analysisRoot` | `.` | Root directory containing repositories |
| `--confFile` | *(auto)* | Landscape configuration file |
| `--name` | *(auto)* | Landscape name |
| `--description` | *(empty)* | Landscape description |

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
planetnik analyzeRemote --repo owner/repo --outputFolder ./report
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
PLANETNIK_DATA_DIR=./report/data bun run --cwd apps/site build

# Or for dev mode
PLANETNIK_DATA_DIR=./report/data bun run --cwd apps/site dev
```

For local developer-specific defaults, prefer `apps/site/.env.local`:

```env
# Prefer an absolute path to avoid cwd ambiguity
PLANETNIK_DATA_DIR=/absolute/path/to/report/data
```

### Deploy to GitHub Pages

The included GitHub Actions workflow (`.github/workflows/analyze-and-deploy.yml`) automates the full pipeline:

1. Trigger manually via `workflow_dispatch` with a `repo` input
2. Or push to `main` to analyze the repository itself
3. The workflow runs `analyzeRemote`, builds the Astro site, and deploys to GitHub Pages

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
| `PLANETNIK_DATA_DIR` | Path to the `data/` directory from a report run. Used by the Astro site and content loaders to find analysis results. |

---

## Output Structure

After analysis, the output folder contains:

```
report/
  index.html              # HTML report index
  html/                   # Standalone HTML report pages
    SourceCodeOverview.html
    Components.html
    Contributors.html
    ...
  data/                   # Machine-readable exports
    analysisResults.json   # Full analysis summary
    files_main.json        # Main source files
    files_test.json        # Test files
    units.json             # Functions/methods
    duplicates.json        # Duplicate code blocks
    metrics.txt            # Key-value metrics
    contributors.txt       # Contributor statistics
    controls.txt           # Goals and controls
    temporal_dependencies.txt
    ...
```

The `data/` directory is the bridge between the CLI analysis and the Astro frontend. Point `PLANETNIK_DATA_DIR` at it to build the static site.
