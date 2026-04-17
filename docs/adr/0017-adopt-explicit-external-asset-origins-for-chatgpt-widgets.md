# ADR-0017: Adopt Explicit External Asset Origins for ChatGPT Widgets

## Status

Proposed

## Context

We investigated repeated 404s affecting a ChatGPT widget that renders a live vehicle carousel.

The observed failure pattern is:

- the widget iframe runs under a ChatGPT sandbox host such as:
  - `https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/?app=chatgpt&locale=en-US&deviceType=desktop`
- the widget HTML/bootstrap can already reference correct APIM-hosted assets such as:
  - `https://apimanagement.motors.co.uk/chat-gpt-app/assets/index-KszrYFOy.js`
  - `https://apimanagement.motors.co.uk/chat-gpt-app/assets/car-and-van-results-carousel-Dn5hJRwg.js`
  - `https://apimanagement.motors.co.uk/chat-gpt-app/assets/inventory-carousel-nav-CjLSUriM.js`
- but some secondary requests are still made to sandbox-root asset paths such as:
  - `https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/assets/car-and-van-results-carousel-Dn5hJRwg.js`
  - `https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/assets/inventory-carousel-nav-CjLSUriM.js`
- those sandbox-hosted asset requests return `404`

The HAR evidence shows that the successful and failing requests are distinct requests to different origins, not cache misses for the same URL. The failing requests are `same-origin` to the sandbox host, while the successful ones are `cross-site` to APIM.

This means the issue is not merely “the file is missing”. It is an asset-origin resolution problem:

- ChatGPT widgets run inside a sandboxed iframe origin.
- Any root-relative path such as `/assets/...` resolves against that sandbox origin.
- Our actual built assets live on APIM today, and may live on Akamai/CDN in the future.
- Therefore, root-relative asset URLs are unsafe for this deployment model.

This is worth capturing as an ADR because:

- it affects every current and future ChatGPT/MCP widget we ship
- it determines how Vite build outputs must be hosted and referenced
- it defines the split of responsibilities between APIM, CDN, and widget code
- it avoids repeated production regressions caused by sandbox-relative asset loads
- it creates a stable pattern for dev, QA, and production deployments

## Decision

We will adopt an explicit external asset-origin strategy for ChatGPT widgets.

### Core policy

- ChatGPT widget assets must not rely on root-relative `/assets/*` URLs.
- Widget static assets must be emitted with an explicit environment-specific external origin.
- APIM will remain the primary host for tool/API traffic and may continue to serve widget HTML/template responses.
- A CDN such as Akamai is the preferred host for built static widget assets in QA and production.
- If CDN is unavailable for a given environment, APIM-hosted absolute asset URLs are an acceptable fallback.
- Widget resource metadata must explicitly allow:
  - API hosts through `connectDomains`
  - static asset hosts through `resourceDomains`
- Widget code must not manually construct root-relative asset URLs such as `/assets/foo.js`, `/images/bar.png`, or equivalent.

### Preferred deployment model

For ChatGPT widget deployments:

- APIM hosts:
  - MCP/tool endpoints
  - dynamic API routes
  - optional widget HTML/template entry documents
- Akamai (or equivalent CDN) hosts:
  - hashed JavaScript chunks
  - CSS bundles
  - images/fonts/static build artifacts
- ChatGPT sandbox hosts:
  - the iframe runtime only
  - no first-party ownership of widget `/assets/*`

### Build policy

Vite must emit environment-specific absolute asset URLs for build outputs.

Recommended pattern:

- local dev server: `base: "/"`
- build outputs: `base: <environment-specific absolute asset base URL>`

Examples:

- development:
  - `https://static-dev.motors.co.uk/chat-gpt-app/`
- QA:
  - `https://static-qa.motors.co.uk/chat-gpt-app/`
- production:
  - `https://static.motors.co.uk/chat-gpt-app/`

Fallback examples if APIM must host static assets directly:

- development:
  - `https://dev-apimanagement.motors.co.uk/chat-gpt-app/`
- QA:
  - `https://qa-apimanagement.motors.co.uk/chat-gpt-app/`
- production:
  - `https://apimanagement.motors.co.uk/chat-gpt-app/`

### Widget metadata policy

Widget resources must declare the correct hosts via `_meta.ui.csp` and, where needed for compatibility, legacy OpenAI widget CSP metadata.

Minimum required categories:

- `connectDomains`
  - APIM origin(s) used for tool/API communication
- `resourceDomains`
  - CDN/APIM origins used for JavaScript, CSS, images, fonts, and other static resources

### Code policy

Allowed patterns:

- bundler-generated imports
- module-relative imports
- imported static assets
- `new URL("./foo.png", import.meta.url)` where appropriate
- `import.meta.env.BASE_URL` if exact build-time replacement is needed

Disallowed patterns in widget code:

- `fetch("/assets/...")`
- `import("/assets/...")`
- `img.src = "/assets/..."`
- hardcoded root-relative static paths that assume same-origin hosting

## Why this option

- It matches the documented ChatGPT widget execution model: widgets run inside a sandbox iframe, not on the APIM origin directly.
- It removes ambiguity from chunk loading by making asset origins explicit.
- It prevents sandbox-origin `/assets/*` resolution from causing 404s.
- It scales cleanly across dev, QA, and production through environment variables.
- It lets us use CDN infrastructure for static assets without coupling dynamic tool traffic to CDN routing.
- It reduces operational load on APIM by moving cache-heavy hashed assets to the CDN tier.
- It aligns with Vite’s documented support for absolute public base URLs.

## Alternatives Considered

### Keep root-relative asset paths and rely on APIM proxying

We are not choosing this because sandbox-origin requests never reach APIM. A request sent to `*.web-sandbox.oaiusercontent.com/assets/...` cannot be rescued by APIM configuration alone.

### Use APIM path rewrites as the primary fix

We are not choosing this because it only helps for requests that already target APIM. It does not solve sandbox-origin root-relative requests.

### Use only pathname base such as `/chat-gpt-app/`

This improves nested hosting on a single origin, but it is insufficient in a sandboxed iframe if the browser still resolves the pathname against the sandbox origin instead of the asset host.

### Use relative base such as `./`

This is safer than root-relative paths and may work for some widget bundles, especially when:

- all asset references are generated by Vite
- lazy chunks are resolved through module-relative imports
- no widget code manually constructs root-relative paths such as `/assets/...`
- the same bundle should remain portable across environments without baking in a host-specific origin

We are not choosing it as the default because our investigated deployment shape is a hybrid one:

- the widget executes inside a ChatGPT sandbox origin
- the real static assets are hosted externally on APIM today and likely CDN later
- operations and debugging are easier when asset origin is explicit in the built output

Relative base therefore remains a valid fallback or secondary strategy, but not the preferred default architecture captured by this ADR.

### Inline or single-bundle all widget assets

This can avoid chunk-loading issues entirely and remains a valid option for very small widgets. We are not choosing it as the default because some widgets are large enough that normal static asset hosting remains preferable.

### Serve everything from APIM permanently

This is viable as a fallback, but not preferred. CDN-hosted static assets give better caching, lower APIM load, and cleaner separation between dynamic and static delivery.

## Consequences

- Every ChatGPT widget build must know its target asset base URL per environment.
- Deployment pipelines must publish built assets to the configured asset origin before exposing the widget.
- Widget metadata must be kept in sync with the chosen API and resource origins.
- Manual root-relative static asset references become a correctness bug, not a stylistic issue.
- APIM configuration becomes simpler because it no longer needs to pretend it can intercept sandbox-origin asset requests.
- CDN adoption becomes straightforward and beneficial for performance and cache control.
- Post-build validation becomes more important so we can verify that no root-relative `/assets/*` paths remain.

## Non-goals

- No change to the underlying MCP/tool semantics
- No requirement that every widget be fully inlined into one HTML resource
- No attempt to make ChatGPT sandbox hosts serve our first-party static assets
- No use of APIM response rewriting as the main long-term strategy for bundle correction
- No change to existing analyzer or report-generation logic outside widget deployment concerns

## Implementation Plan

- **Affected systems**:
  - widget build configuration (Vite)
  - widget resource registration / response metadata
  - APIM configuration for API endpoints and optional HTML/template delivery
  - CDN publishing pipeline (Akamai or equivalent)
  - deployment environment variables for dev, QA, and production

- Introduce environment-specific asset base variables, for example:
  - `VITE_PUBLIC_ASSET_BASE_URL`
  - `VITE_PUBLIC_API_BASE_URL`

- Configure Vite so that:
  - `serve` uses `base: "/"`
  - `build` uses absolute `VITE_PUBLIC_ASSET_BASE_URL`

- Example preferred Vite configuration:

```ts
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const assetBaseUrl = env.VITE_PUBLIC_ASSET_BASE_URL

  if (command === "build" && !assetBaseUrl) {
    throw new Error(`Missing VITE_PUBLIC_ASSET_BASE_URL for mode "${mode}"`)
  }

  return {
    plugins: [react()],
    base: command === "serve" ? "/" : assetBaseUrl,
    build: {
      manifest: true,
    },
  }
})
```

- Example environment values:

```env
# .env.development
VITE_PUBLIC_ASSET_BASE_URL=https://static-dev.motors.co.uk/chat-gpt-app/
VITE_PUBLIC_API_BASE_URL=https://dev-apimanagement.motors.co.uk
```

```env
# .env.qa
VITE_PUBLIC_ASSET_BASE_URL=https://static-qa.motors.co.uk/chat-gpt-app/
VITE_PUBLIC_API_BASE_URL=https://qa-apimanagement.motors.co.uk
```

```env
# .env.production
VITE_PUBLIC_ASSET_BASE_URL=https://static.motors.co.uk/chat-gpt-app/
VITE_PUBLIC_API_BASE_URL=https://apimanagement.motors.co.uk
```

- The asset base URL should include a trailing slash.
  - Preferred: `https://dev-apimanagement.motors.co.uk/chat-gpt-app/`
  - Avoid: `https://dev-apimanagement.motors.co.uk/chat-gpt-app`
  - This matches Vite's documented `base` shape, which uses `/foo/` and `https://bar.com/foo/` style values.

- Example secondary Vite configuration if relative base is chosen intentionally:

```ts
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    manifest: true,
  },
})
```

- If the relative-base option is used, the build must still be verified to ensure:
  - all lazy chunks remain module-relative
  - no manual root-relative `/assets/*` references exist in widget code
  - the resulting bundle loads correctly inside the ChatGPT sandbox iframe

- Preferred environment mapping:
  - dev:
    - API origin: `https://dev-apimanagement.motors.co.uk`
    - asset origin: `https://static-dev.motors.co.uk/chat-gpt-app/`
  - QA:
    - API origin: `https://qa-apimanagement.motors.co.uk`
    - asset origin: `https://static-qa.motors.co.uk/chat-gpt-app/`
  - production:
    - API origin: `https://apimanagement.motors.co.uk`
    - asset origin: `https://static.motors.co.uk/chat-gpt-app/`

- Configure widget metadata so that:
  - `connectDomains` includes only the required API origin(s)
  - `resourceDomains` includes CDN/APIM static origins and any image/font origins

- Ensure deployment pipeline publishes hashed static assets to the configured CDN path before widget rollout.

- Add post-build validation checks for forbidden root-relative asset references.

- Keep APIM as the fallback asset origin if CDN rollout is blocked, but preserve the same explicit-absolute-origin strategy.

## Verification

- [ ] Built widget HTML references the entry module using an absolute environment-specific asset origin
- [ ] Built lazy chunks also resolve to the explicit external asset origin
- [ ] No root-relative `"/assets/` or `'/assets/` references remain in widget build artifacts unless intentionally same-origin hosted
- [ ] Widget `connectDomains` include the correct APIM environment
- [ ] Widget `resourceDomains` include the correct CDN/APIM asset host and any supporting resource hosts
- [ ] ChatGPT widget loads without sandbox-origin asset 404s in dev, QA, and production
- [ ] Successful asset requests go to the configured external asset origin, not the sandbox host
- [ ] Manual widget code does not construct root-relative static asset paths
- [ ] CDN-hosted hashed assets are served with strong immutable cache headers
- [ ] HTML/template documents are served with cache semantics that allow safe rollout of new asset versions

## References

### Local evidence

- [404 HAR: sandbox asset request](/Users/alan/Downloads/404-chatgpt.com_assets_inventory-carousel-nav-CjLSUriM.js_Archive%20%5B26-04-07%2018-46-37%5D.har)
- [200 HAR: APIM asset request](/Users/alan/Downloads/200-chatgpt.com_chat-gpt-app_assets_inventory-carousel-nav-CjLSUriM.js_Archive%20%5B26-04-07%2018-47-06%5D.har)
- [Conversation HAR with full widget flow](/Users/alan/Downloads/gig-har-chatgpt.com_Archive%20%5B26-04-07%2018-50-36%5D.har)

### Runtime URLs analyzed

- <https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/?app=chatgpt&locale=en-US&deviceType=desktop>
- <https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/assets/car-and-van-results-carousel-Dn5hJRwg.js>
- <https://apimanagement-motors-co-uk.web-sandbox.oaiusercontent.com/assets/inventory-carousel-nav-CjLSUriM.js>
- <https://apimanagement.motors.co.uk/chat-gpt-app/assets/car-and-van-results-carousel-Dn5hJRwg.js>
- <https://apimanagement.motors.co.uk/chat-gpt-app/assets/inventory-carousel-nav-CjLSUriM.js>

### OpenAI / ChatGPT docs analyzed

- <https://developers.openai.com/apps-sdk/reference/>
- <https://developers.openai.com/apps-sdk/build/custom-ux>
- <https://developers.openai.com/apps-sdk/build/mcp-server>
- <https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt>

### Vite docs analyzed

- <https://vite.dev/config/shared-options#base>
- <https://vite.dev/guide/build#public-base-path>
- <https://vite.dev/guide/assets>
- <https://vite.dev/guide/backend-integration>
