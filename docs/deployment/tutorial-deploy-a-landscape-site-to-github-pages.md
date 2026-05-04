# Tutorial: Deploy a landscape site to GitHub Pages

This tutorial takes you through the happy path for publishing a Planetnik landscape site with GitHub Actions.

By the end, GitHub Actions will:

1. analyze the repositories in your landscape
2. build the Astro site in `apps/site`
3. publish the generated static site to GitHub Pages
4. refresh it automatically on the weekly schedule in `.github/workflows/deploy.yml`

This tutorial is intentionally opinionated. We will deploy **landscape mode** using the repository’s committed defaults, with security data enabled.

If you already know what you want and just need a task-focused recipe, jump to [`how-to-deploy-the-site-with-github-actions.md`](./how-to-deploy-the-site-with-github-actions.md).

## Before you begin

Make sure you have:

- admin or maintainer access to the GitHub repository that hosts Planetnik
- a GitHub token that can clone the target repositories and read Dependabot alerts for them
- a committed `landscape-config.json` in the repository root

## 1. Enable GitHub Pages for Actions

In your GitHub repository:

1. Open **Settings** → **Pages**.
2. Set **Source** to **GitHub Actions**.

This repository already contains the deploy workflow at `.github/workflows/deploy.yml`, so you do not need to create a Pages workflow from scratch.

## 2. Set the repository’s default deployment mode

Open `planetnik.config.json` and make sure it selects landscape mode:

```json
{
  "mode": "landscape"
}
```

That tells the deploy workflow to use the landscape branch of the pipeline whenever you do not override `mode` manually.

## 3. Commit a deployment-ready `landscape-config.json`

Open `landscape-config.json` and make sure it contains the landscape you want to publish.

A minimal deployment-ready example looks like this:

```json
{
  "githubCloneUrl": "https://github.com",
  "githubApiUrl": "https://api.github.com",
  "reposUpdatedAfter": "2024-01-01",
  "metadata": {
    "name": "Example Landscape",
    "description": "Multi-repository landscape analysis"
  },
  "mergeExtensions": [{ "primary": "ts", "secondary": "tsx" }],
  "security": {
    "enabled": true,
    "fetchAlerts": true,
    "fetchSBOM": false
  },
  "githubOrgs": ["example-org"],
  "ignore": [
    { "org": "", "repo": "\\.github" }
  ]
}
```

A few important points:

- Commit the **shape** of the landscape, not the secret.
- Do **not** commit `githubToken` for CI use.
- Keep `security.enabled: true` and `security.fetchAlerts: true` if you want the `/landscape/security` page to be populated.

During deployment, the workflow writes your GitHub secret into a temporary `_landscape-config.json`. Your committed file stays clean.

## 4. Add the required GitHub secret

In GitHub, open **Settings** → **Secrets and variables** → **Actions** and add:

- `LANDSCAPE_GITHUB_TOKEN`

The deploy workflow requires this secret in landscape mode.

If the token is missing, the workflow stops before analysis begins. If the token cannot read the required security data, the workflow fails during the security export verification step.

## 5. Run the deploy workflow

Open **Actions** → **Deploy** → **Run workflow**.

Use these inputs:

- **mode**: leave blank to use `planetnik.config.json`, or set it to `landscape`
- **config**: `landscape-config.json`
- **concurrency**: `4` (or another value appropriate for your repo count)
- **name**: optional landscape title override

Then run the workflow.

## 6. Watch for the expected checkpoints

In a successful run, you should see these milestones in the job log:

1. **Resolve deploy mode** reports `landscape`
2. **Prepare landscape config** creates `_landscape-config.json`
3. **Run landscape analysis** writes data to `_landscape/_planetnik_landscape/reports/data`
4. **Verify landscape security exports** confirms:
   - `landscape_dependency_health.json`
   - `landscape_dependency_alerts.json`
5. **Build Astro site (landscape)** completes successfully
6. **Deploy to GitHub Pages** publishes the site

The workflow summary should clearly show the chosen deploy mode.

## 7. Open the published site

After the run completes, GitHub Pages serves the generated site.

In landscape mode, the important routes include:

- `/landscape`
- `/landscape/repositories`
- `/landscape/contributors`
- `/landscape/teams`
- `/landscape/topology`
- `/landscape/tags`
- `/landscape/security`

If those routes load with real data, the pipeline is working end to end.

## 8. Let the schedule keep it fresh

The deploy workflow also runs on a weekly schedule:

- Monday at 06:00 UTC

Because `planetnik.config.json` is committed with `"mode": "landscape"`, scheduled runs continue to refresh the same landscape automatically.

## What you accomplished

You now have a repository where:

- `planetnik.config.json` sets the default deploy mode
- `landscape-config.json` defines what gets analyzed
- `LANDSCAPE_GITHUB_TOKEN` supplies secure runtime access
- GitHub Actions builds and publishes the Astro site to GitHub Pages

For task-specific variations, continue with:

- [`How to deploy the site with GitHub Actions`](./how-to-deploy-the-site-with-github-actions.md)
- [`How to configure planetnik.config.json and landscape-config.json for deployment`](./how-to-configure-planetnik-and-landscape-config-for-deployment.md)
- [`GitHub Actions deployment reference`](./reference-github-actions-deployment.md)
