# Deployment

This section now follows the [Diátaxis](https://diataxis.fr/) framework so deployment information is easier to navigate by need instead of being packed into one mega-page.

Planetnik deployment has a few moving parts:

- `.github/workflows/deploy.yml` publishes the site with GitHub Actions
- `planetnik.config.json` chooses the default deploy mode
- `landscape-config.json` defines the landscape analysis inputs when landscape mode is used
- `apps/site` builds a static Astro site from generated analysis data

## Choose the page that matches your need

### Learn by doing

- [`Tutorial: Deploy a landscape site to GitHub Pages`](./deployment/tutorial-deploy-a-landscape-site-to-github-pages.md)

Use the tutorial if you want one reliable, end-to-end path that gets a landscape deployment working.

### Get a specific deployment task done

- [`How to deploy the site with GitHub Actions`](./deployment/how-to-deploy-the-site-with-github-actions.md)
- [`How to configure planetnik.config.json and landscape-config.json for deployment`](./deployment/how-to-configure-planetnik-and-landscape-config-for-deployment.md)

Use the how-to guides when you already know the outcome you want and need the shortest route to it.

### Look up exact behavior or config details

- [`GitHub Actions deployment reference`](./deployment/reference-github-actions-deployment.md)

Use the reference when you need precise workflow inputs, mode resolution rules, secrets, paths, or config keys.

### Understand why deployment is designed this way

- [`Why deployment is split between mode, analysis config, and secrets`](./deployment/explanation-deployment-model.md)

Use the explanation when you want the architectural reasoning behind the split between `planetnik.config.json`, `landscape-config.json`, workflow inputs, and GitHub secrets.

## Quick orientation

Planetnik does not deploy a long-running server. It deploys a **static site generated from analysis data**.

The high-level flow is:

1. analyze repositories with the Bun CLI
2. export report data
3. point Astro at the generated data directory
4. build `apps/site`
5. publish the resulting static site to GitHub Pages

That is why deployment docs in this project need to cover both **GitHub Actions** and **analysis configuration**.

## The two config files in one sentence each

- `planetnik.config.json`: **Which deploy mode should this repository use by default?**
- `landscape-config.json`: **What landscape should be discovered, analyzed, filtered, and enriched?**

If you only need the exact field-level details, go straight to the [deployment reference](./deployment/reference-github-actions-deployment.md).
