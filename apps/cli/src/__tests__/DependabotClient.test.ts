import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { fetchDependabotAlerts } from "../github/DependabotClient.js"

const ALERT_FIXTURE = {
  number: 1,
  state: "open",
  dependency: {
    package: { ecosystem: "npm", name: "lodash" },
    manifest_path: "package.json",
    scope: "runtime",
  },
  security_advisory: {
    ghsa_id: "GHSA-xxxx-yyyy-zzzz",
    cve_id: "CVE-2021-23337",
    summary: "Prototype Pollution in lodash",
    severity: "critical",
    published_at: "2021-02-15T00:00:00Z",
  },
  security_vulnerability: {
    severity: "critical",
    vulnerable_version_range: "< 4.17.21",
    first_patched_version: { identifier: "4.17.21" },
  },
  created_at: "2021-03-01T00:00:00Z",
  updated_at: "2021-03-02T00:00:00Z",
  fixed_at: null,
  auto_dismissed_at: null,
}

const originalFetch = globalThis.fetch

describe("fetchDependabotAlerts", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("fetches alerts from a single page", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify([ALERT_FIXTURE]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })),
    ) as typeof fetch

    const alerts = await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")

    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.security_advisory.cve_id).toBe("CVE-2021-23337")
    expect(alerts[0]!.state).toBe("open")
  })

  test("follows cursor pagination via Link headers", async () => {
    const page1Alert = { ...ALERT_FIXTURE, number: 1 }
    const page2Alert = { ...ALERT_FIXTURE, number: 2 }

    let callCount = 0
    globalThis.fetch = mock(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve(new Response(JSON.stringify([page1Alert]), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            Link: '<https://api.github.com/repos/alanpcurrie/my-repo/dependabot/alerts?after=cursor1&per_page=100>; rel="next"',
          },
        }))
      }
      return Promise.resolve(new Response(JSON.stringify([page2Alert]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    }) as typeof fetch

    const alerts = await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")

    expect(alerts).toHaveLength(2)
    expect(alerts[0]!.number).toBe(1)
    expect(alerts[1]!.number).toBe(2)
    expect(callCount).toBe(2)
  })

  test("returns empty array on 403 (no security_events scope)", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })),
    ) as typeof fetch

    const alerts = await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")
    expect(alerts).toEqual([])
  })

  test("returns empty array on 404 (Dependabot not enabled)", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })),
    ) as typeof fetch

    const alerts = await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")
    expect(alerts).toEqual([])
  })

  test("throws on unexpected error status", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    ) as typeof fetch

    expect(fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")).rejects.toThrow()
  })

  test("sends correct authorization header", async () => {
    let capturedHeaders: Headers | undefined
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    }) as typeof fetch

    await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")

    expect(capturedHeaders!.get("Authorization")).toBe("token ghp_token")
    expect(capturedHeaders!.get("User-Agent")).toBe("planetnik")
  })

  test("works without a token", async () => {
    let capturedHeaders: Headers | undefined
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    }) as typeof fetch

    await fetchDependabotAlerts("alanpcurrie", "my-repo", undefined, "https://api.github.com")

    expect(capturedHeaders!.get("Authorization")).toBeNull()
  })

  test("builds correct initial URL", async () => {
    let capturedUrl = ""
    globalThis.fetch = mock((url: string) => {
      capturedUrl = url
      return Promise.resolve(new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
    }) as typeof fetch

    await fetchDependabotAlerts("alanpcurrie", "my-repo", "ghp_token", "https://api.github.com")

    expect(capturedUrl).toBe("https://api.github.com/repos/alanpcurrie/my-repo/dependabot/alerts?per_page=100")
  })
})
