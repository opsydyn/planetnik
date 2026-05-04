# How to configure `planetnik.config.json` and `landscape-config.json` for deployment

Use this guide when you need to decide what belongs in each config file and how those files affect GitHub Actions deployment.

## Set the default deployment mode in `planetnik.config.json`

`planetnik.config.json` tells `.github/workflows/deploy.yml` which branch of the deploy pipeline to prefer when you do not provide a manual override.

### Default to single-repository deployment

```json
{
  "mode": "single_repository"
}
```

Use this when the site should usually analyze and publish one repository at a time.

### Default to landscape deployment

```json
{
  "mode": "landscape"
}
```

Use this when the site should usually analyze multiple repositories and publish the landscape routes under `/landscape`.

### Keep `planetnik.config.json` small

For deployment, keep this file focused on deployment mode selection.

That makes it easy to answer the question: **what kind of site should this repository publish by default?**

## Configure the landscape itself in `landscape-config.json`

`landscape-config.json` answers a different question: **what should landscape analysis include, and how should it behave?**

A deployment-oriented example:

```json
{
  "githubCloneUrl": "https://github.com",
  "githubApiUrl": "https://api.github.com",
  "reposUpdatedAfter": "2024-01-01",
  "metadata": {
    "name": "Alan Currie - personal repo",
    "description": "Multi-repository landscape analysis of Alan Currie's repositories"
  },
  "mergeExtensions": [{ "primary": "ts", "secondary": "tsx" }],
  "security": {
    "enabled": true,
    "fetchAlerts": true,
    "fetchSBOM": false
  },
  "githubOrgs": ["alanpcurrie"],
  "ignore": [
    { "org": "", "repo": "\\.github" },
    { "org": "", "repo": "^website$" },
    { "org": "", "repo": "^docs$" }
  ]
}
```

## Keep secrets out of committed config

For GitHub Actions deployment:

- commit `landscape-config.json`
- store the token in the `LANDSCAPE_GITHUB_TOKEN` secret
- let the workflow create a temporary `_landscape-config.json`

Do **not** rely on a committed `githubToken` value for CI.

The workflow’s `Prepare landscape config` step injects the secret at runtime.

## Choose the right landscape fields

### Required for meaningful deployment

These fields usually matter most:

- `metadata.name`
- `metadata.description`
- `githubOrgs`
- `reposUpdatedAfter`
- `ignore`
- `security`

### Useful for better report quality

These are optional, but often worth configuring:

- `mergeExtensions` to unify related file extensions in reports
- `teamsConfig` to power team views
- `tagGroups` to enrich repository grouping and tagging

## Configure security data intentionally

If you want `/landscape/security` to show real data:

```json
{
  "security": {
    "enabled": true,
    "fetchAlerts": true,
    "fetchSBOM": false
  }
}
```

Also make sure `LANDSCAPE_GITHUB_TOKEN` can read the required alerts.

Important behavior:

- `analyzeLandscape` fetches the security data
- `updateLandscape` does **not** backfill it later
- the deploy workflow fails if the expected security export files are missing

## Decide whether to commit landscape mode as the default

A good rule of thumb:

- choose `single_repository` when the repository mainly publishes one report site
- choose `landscape` when the repository mainly publishes organization-level or multi-repo reporting

If your scheduled deployments should keep publishing a landscape, commit:

```json
{
  "mode": "landscape"
}
```

That avoids ambiguity between push runs and scheduled runs.

## Validate configuration before merging

If you want to test the same inputs locally before GitHub Actions uses them:

```bash
bun run apps/cli/src/index.ts analyzeLandscape \
  --config ./landscape-config.json \
  --outputFolder ./datasets/validation \
  --name "Validation Landscape"
```

Then build the Astro site against the generated dataset:

```bash
PLANETNIK_LANDSCAPE_DATA_DIR=$PWD/datasets/validation/_planetnik_landscape/reports/data \
  bun run --cwd apps/site build
```

That gives you a fast pre-merge check for config changes.

## Related pages

- [`How to deploy the site with GitHub Actions`](./how-to-deploy-the-site-with-github-actions.md)
- [`GitHub Actions deployment reference`](./reference-github-actions-deployment.md)
- [`Why deployment is split between mode, analysis config, and secrets`](./explanation-deployment-model.md)
