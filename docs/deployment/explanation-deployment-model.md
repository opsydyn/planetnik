# Why deployment is split between mode, analysis config, and secrets

Planetnik deployment looks slightly unusual at first because it is not deploying a long-running web service. It is deploying a **static site built from generated analysis data**.

That shape explains why deployment is split across:

- `planetnik.config.json`
- `landscape-config.json`
- GitHub Actions secrets
- `.github/workflows/deploy.yml`

## The site is static, but the data is generated

The deployed artifact is the Astro build output from `apps/site/dist`.

However, Astro cannot build the final site until Planetnik has generated analysis data first.

So the real deployment pipeline is:

1. analyze source repositories
2. export report data
3. point Astro at the exported data directory
4. build the static site
5. publish the static site to GitHub Pages

This is why deployment documentation for Planetnik has to talk about analysis configuration as well as Pages publishing.

## `planetnik.config.json` answers “which deploy path?”

`planetnik.config.json` is the smallest and highest-level decision point.

Its job is not to describe repositories, tags, teams, or security behavior. Its job is to answer one question for the deploy workflow:

**Should this repository deploy a single-repository site or a landscape site by default?**

That is why the file is most useful when it stays small and declarative.

## `landscape-config.json` answers “what landscape should we build?”

Once the workflow knows it is in landscape mode, it needs a much richer description of the analysis itself.

That is what `landscape-config.json` provides:

- which orgs or owners to discover
- which repositories to ignore
- how to name the generated landscape
- whether security data should be fetched
- optional team and tag metadata

This separation keeps the default deploy choice independent from the details of landscape analysis.

## Secrets are injected at runtime because they are operational, not descriptive

The committed config describes the intended analysis.

The token is different. It is an operational credential.

That is why the workflow injects `LANDSCAPE_GITHUB_TOKEN` into a temporary `_landscape-config.json` instead of relying on a committed `githubToken` value.

This gives you three benefits:

1. no secret needs to live in the repository
2. rotation is easy and does not require a config commit
3. the committed config stays portable and reviewable

In short: the config says **what** to analyze; the secret enables **access** to analyze it.

## Why landscape deploys verify security exports

Landscape security data is not decorative. It powers the `/landscape/security` view.

Because of that, the deploy workflow verifies that these files exist:

- `landscape_dependency_health.json`
- `landscape_dependency_alerts.json`

Without that check, a deployment could succeed technically while publishing an incomplete or misleading security view.

The verification step makes this failure loud instead of silent. That is a good trade: a noisy failure in CI is much cheaper than a quietly broken report site.

## Why scheduled runs fall back to landscape

The workflow has a small but important opinion built in:

- scheduled runs default to `landscape` if no mode is configured
- push/manual runs default to `single_repository` if no mode is configured

That reflects two common maintenance patterns:

- scheduled automation is especially useful for multi-repository landscapes that need periodic refreshes
- ad hoc pushes and manual runs are commonly used for single-repository validation

Even so, the safest approach is to commit `planetnik.config.json` explicitly so the workflow does not need to guess.

## Why this separation makes the docs better too

The old deployment story tended to blur together:

- how to run the workflow
- how to configure the landscape
- what the config keys mean
- why the workflow behaves the way it does

Those are different user needs, so they deserve different kinds of documentation.

That is why this section is now split using Diátaxis:

- the **tutorial** walks through one successful deployment path
- the **how-to guides** help you achieve specific deployment tasks
- the **reference** lists the exact workflow inputs, fields, and behavior
- this **explanation** page describes why the system is designed this way

That separation is not just tidier. It makes the documentation easier to trust while you are trying to ship something.
