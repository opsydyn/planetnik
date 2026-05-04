# How to deploy the site with GitHub Actions

Use this guide when you already know what outcome you want and need the shortest path to it.

The site deploy workflow lives in `.github/workflows/deploy.yml`.

## Deploy using the repository’s committed defaults

Use this when `planetnik.config.json` already describes the default mode you want.

1. Commit any changes to `planetnik.config.json` and, if applicable, `landscape-config.json`.
2. Push to `main`, or open **Actions** → **Deploy** → **Run workflow**.
3. Leave the **mode** input blank.
4. Wait for the workflow summary to confirm the resolved deploy mode.

This is the lowest-friction option, because the workflow reads `planetnik.config.json` for you.

## Deploy a single-repository report for one run

Use this when you want to override the repository default without changing committed config.

In **Actions** → **Deploy** → **Run workflow**, set:

- **mode**: `single_repository`
- **repo**: the repository to analyze, such as `facebook/react`
- **ref**: the branch or tag to analyze, such as `main`
- **name**: optional site title override

The workflow will:

1. run `analyzeRemote`
2. build `apps/site` with `PLANETNIK_DATA_DIR`
3. publish the static output to GitHub Pages

Use this for ad hoc single-repository demos, previews, or temporary report sites.

## Deploy a landscape report for one run

Use this when you want to force a landscape deployment regardless of the committed default.

In **Actions** → **Deploy** → **Run workflow**, set:

- **mode**: `landscape`
- **config**: the path to the landscape config file, usually `landscape-config.json`
- **concurrency**: the number of repositories to analyze in parallel
- **name**: optional landscape title override

Before you run it, make sure the repository has a `LANDSCAPE_GITHUB_TOKEN` secret.

The workflow will:

1. inject `LANDSCAPE_GITHUB_TOKEN` into a temporary `_landscape-config.json`
2. run `analyzeLandscape`
3. verify the exported security files
4. build `apps/site` with `PLANETNIK_LANDSCAPE_DATA_DIR`
5. publish the site to GitHub Pages

## Re-run deployment after changing configuration

When you change deployment behavior, commit the relevant file first:

- change `planetnik.config.json` to change the repository default mode
- change `landscape-config.json` to change which repositories, filters, tags, teams, or security options are used in landscape mode

Then either:

- push to `main`, or
- run the workflow manually

If you change only the secret value, no file change is needed; just update the secret and re-run the workflow.

## Trigger the workflow from GitHub CLI

If you prefer the GitHub CLI, you can trigger the same workflow from a terminal.

### Single repository

```bash
gh workflow run Deploy \
  -f mode=single_repository \
  -f repo=facebook/react \
  -f ref=main \
  -f name=React
```

### Landscape

```bash
gh workflow run Deploy \
  -f mode=landscape \
  -f config=landscape-config.json \
  -f concurrency=4 \
  -f name="Example Landscape"
```

## Troubleshoot failed deployments

### The workflow says `LANDSCAPE_GITHUB_TOKEN` is required

You are running landscape mode without the required secret.

Add `LANDSCAPE_GITHUB_TOKEN` in **Settings** → **Secrets and variables** → **Actions**, then re-run.

### The workflow fails while verifying landscape security exports

The analysis completed, but the workflow could not find:

- `landscape_dependency_health.json`
- `landscape_dependency_alerts.json`

Check all of the following:

- `security.enabled` is `true` in `landscape-config.json`
- `security.fetchAlerts` is `true`
- the token can read Dependabot alerts for the analyzed repositories

### The site deploys the wrong mode

The workflow resolves mode in this order:

1. manual `mode` input
2. `planetnik.config.json`
3. built-in fallback based on event type

If the result surprises you, check both the workflow input values and the committed `planetnik.config.json`.

### A scheduled run behaves differently from a push run

That is expected when `planetnik.config.json` is missing or does not contain `mode`.

- scheduled runs fall back to `landscape`
- push and manual runs without a `mode` input fall back to `single_repository`

For predictable behavior, commit `planetnik.config.json` explicitly.

## Related pages

- [`How to configure planetnik.config.json and landscape-config.json for deployment`](./how-to-configure-planetnik-and-landscape-config-for-deployment.md)
- [`GitHub Actions deployment reference`](./reference-github-actions-deployment.md)
- [`Why deployment is split between mode, analysis config, and secrets`](./explanation-deployment-model.md)
