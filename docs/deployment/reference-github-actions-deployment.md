# GitHub Actions deployment reference

This page describes the deployment machinery exactly as implemented in `.github/workflows/deploy.yml`.

## Workflow file

- Workflow: `.github/workflows/deploy.yml`
- Site app: `apps/site`
- Default config files:
  - `planetnik.config.json`
  - `landscape-config.json`

## Triggers

- `push`
  - Runs on pushes to `main`.
  - Uses `planetnik.config.json` when `mode` is not manually supplied.
- `workflow_dispatch`
  - Runs manually from the GitHub UI or GitHub CLI.
  - Supports input overrides for mode, repo, ref, name, config, and concurrency.
- `schedule`
  - Runs every Monday at 06:00 UTC.
  - Falls back to `landscape` if `planetnik.config.json` does not define `mode`.

## Manual workflow inputs

- `mode`
  - Required: no
  - Default: empty
  - Used in: both modes
  - Purpose: overrides `planetnik.config.json` for a single run.
- `repo`
  - Required: no
  - Default: `github.repository`
  - Used in: `single_repository`
  - Purpose: repository to analyze with `analyzeRemote`.
- `ref`
  - Required: no
  - Default: `main`
  - Used in: `single_repository`
  - Purpose: branch or tag to analyze.
- `name`
  - Required: no
  - Default: empty
  - Used in: both modes
  - Purpose: project or landscape title override.
- `config`
  - Required: no
  - Default: `landscape-config.json`
  - Used in: `landscape`
  - Purpose: landscape config file path.
- `concurrency`
  - Required: no
  - Default: `4`
  - Used in: `landscape`
  - Purpose: parallel repository analysis count.

## Mode resolution rules

The workflow resolves deploy mode in this order.

- `workflow_dispatch` with `mode` input set
  - Use the input value.
- `push` or `workflow_dispatch` without a `mode` input
  - Read `.mode` from `planetnik.config.json`.
  - If the file does not define `mode`, fall back to `single_repository`.
- `schedule` without a `mode` input
  - Read `.mode` from `planetnik.config.json`.
  - If the file does not define `mode`, fall back to `landscape`.

## `planetnik.config.json`

Deployment currently relies on one field.

- `mode`
  - Allowed values: `single_repository`, `landscape`
  - Meaning: selects the default branch of the deploy workflow.

### Example

```json
{
  "mode": "landscape"
}
```

## `landscape-config.json`

This file defines what landscape analysis will discover, analyze, and export.

### Common deployment keys

- `githubCloneUrl` (`string`)
  - Base clone URL, typically `https://github.com`.
- `githubApiUrl` (`string`)
  - Base API URL, typically `https://api.github.com`.
- `githubToken` (`string`)
  - Optional token field.
  - Avoid committing this for CI; prefer secrets.
- `reposUpdatedAfter` (`string`)
  - Filter threshold for active repositories.
- `metadata.name` (`string`)
  - Landscape title shown in generated output.
- `metadata.description` (`string`)
  - Landscape description shown in generated output.
- `mergeExtensions` (`array`)
  - Merges related extensions in analysis views, for example `ts` + `tsx`.
- `security.enabled` (`boolean`)
  - Enables landscape security processing.
- `security.fetchAlerts` (`boolean`)
  - Fetches Dependabot alert data.
- `security.fetchSBOM` (`boolean`)
  - Enables SBOM collection when supported.
- `githubOrgs` (`array`)
  - GitHub organizations or owners to discover.
- `ignore` (`array`)
  - Regex filters for repositories to skip.
- `teamsConfig` (`object`)
  - Optional team definitions for team views.
- `tagGroups` (`array`)
  - Optional tag group definitions for repository tagging.

## Secrets and tokens

- `GITHUB_TOKEN`
  - Required: built in
  - Used for: single-repository deploys
  - Notes: the workflow uses the GitHub-provided token to rewrite `https://github.com/` clone URLs.
- `LANDSCAPE_GITHUB_TOKEN`
  - Required: yes, in `landscape` mode
  - Used for: landscape deploys
  - Notes: injected into a temporary `_landscape-config.json` and used for clone access plus security export fetching.

## Single-repository pipeline

When mode resolves to `single_repository`, the workflow does this:

1. run `analyzeRemote`
2. write analysis output to `_reports`
3. set `PLANETNIK_DATA_DIR=$GITHUB_WORKSPACE/_reports/data`
4. run `bun run build` in `apps/site`
5. upload `apps/site/dist`
6. deploy to GitHub Pages

## Landscape pipeline

When mode resolves to `landscape`, the workflow does this:

1. require `LANDSCAPE_GITHUB_TOKEN`
2. copy `landscape-config.json` to a temporary `_landscape-config.json` with token injected
3. run `analyzeLandscape --config _landscape-config.json --outputFolder _landscape`
4. verify:
   - `_landscape/_planetnik_landscape/reports/data/landscape_dependency_health.json`
   - `_landscape/_planetnik_landscape/reports/data/landscape_dependency_alerts.json`
5. set `PLANETNIK_LANDSCAPE_DATA_DIR=$GITHUB_WORKSPACE/_landscape/_planetnik_landscape/reports/data`
6. run `bun run build` in `apps/site`
7. upload `apps/site/dist`
8. deploy to GitHub Pages

## Build-time environment variables

- `PLANETNIK_DATA_DIR`
  - Set in mode: `single_repository`
  - Value: `${GITHUB_WORKSPACE}/_reports/data`
- `PLANETNIK_LANDSCAPE_DATA_DIR`
  - Set in mode: `landscape`
  - Value: `${GITHUB_WORKSPACE}/_landscape/_planetnik_landscape/reports/data`

## Output directories

- `_reports`
  - Single-repository analysis output root.
- `_reports/data`
  - Single-repository data consumed by the Astro build.
- `_landscape`
  - Landscape analysis output root.
- `_landscape/_planetnik_landscape/reports/data`
  - Landscape data consumed by the Astro build.
- `apps/site/dist`
  - Static site uploaded to GitHub Pages.

## Security export requirements

Landscape deploys must produce both files below when security export is enabled:

- `landscape_dependency_health.json`
- `landscape_dependency_alerts.json`

If either file is missing, the deploy workflow fails intentionally.

## Related workflow

This repository also contains `.github/workflows/deploy-datasets.yml`, which is concerned with hosted dataset generation and upload rather than GitHub Pages site publishing.

Use `.github/workflows/deploy.yml` when the goal is: **build and publish the site**.
