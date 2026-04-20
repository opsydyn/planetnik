import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

mock.module("./constants.js", () => ({
  SERVER_BASE_URL: "http://example.test",
}))

const originalFetch = globalThis.fetch

const fetchMock = mock(async (input: string | URL | Request) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url

  if (url.endsWith("/api/auth/get-session")) {
    return new Response(
      JSON.stringify({
        user: {
          id: "user_123",
          email: "alan@example.com",
          name: "Alan",
          role: "admin",
        },
        session: {
          id: "session_123",
          userId: "user_123",
          expiresAt: "2026-04-30T00:00:00.000Z",
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )
  }

  if (url.endsWith("/api/auth/sign-out")) {
    return new Response(null, {
      status: 200,
      headers: {
        "set-cookie": "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly",
      },
    })
  }

  if (url.endsWith("/gen-ui-beta-surface")) {
    return new Response(
      JSON.stringify({
        surface: {
          root: "surface-root",
          components: [
            {
              id: "pressure-card",
              component: {
                type: "Card",
              },
            },
          ],
          data: {
            title: "Pressure summary",
          },
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )
  }

  if (url.includes("/contributors/")) {
    return new Response(
      JSON.stringify({
        contributor: {
          email: "alan@example.com",
          userName: "alan",
          displayName: "Alan",
          status: "Active",
          commitsCount: 1,
          commitsCount30Days: 1,
          commitsCount90Days: 1,
          commitsCount180Days: 1,
          commitsCount365Days: 1,
          firstCommitDate: "2026-04-01",
          latestCommitDate: "2026-04-01",
          percentage: "100%",
          activeDays: 1,
          filesCount: 1,
          collaboratorsCount: 0,
          topCollaboratorEmail: null,
          topCollaboratorDisplayName: null,
          extensions: [],
          logicalComponents: [],
          collaborators: [],
          topFiles: [],
          dailyActivity: [],
          impact: null,
        },
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    )
  }

  return new Response(
    JSON.stringify({
      repository: {
        repoKey: "alanpcurrie/next-app-playground",
        name: "next-app-playground",
        description: "next-app-playground",
        latestCommitDate: "2026-04-01",
        commits30d: 1,
        commits90d: 2,
        contributorsCount: 3,
        filesCount: 4,
        linesOfCode: 5,
        duplicationPercentage: null,
        links: [],
        contributors: [],
        topContributors: [],
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  )
})

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

beforeEach(() => {
  fetchMock.mockClear()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

const {
  getRuntimeAuthSession,
  getRuntimeReportGenUiBetaSurface,
  getRuntimeReportContributorDetail,
  getRuntimeReportLandscapeRepository,
  getRuntimeReportLandscapeRepositoryContributorDetail,
  signOutRuntimeAuthSession,
} = await import("./runtime-client.js")

describe("runtime client auth and surface helpers", () => {
  test("resolves auth session data through the shared runtime client", async () => {
    const session = await getRuntimeAuthSession("better-auth.session_token=abc")

    expect(session.user?.email).toBe("alan@example.com")
    expect(session.session?.id).toBe("session_123")
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/auth/get-session",
    )
  })

  test("forwards sign-out to the runtime and returns forwarded cookies", async () => {
    const cookies = await signOutRuntimeAuthSession("better-auth.session_token=abc")

    expect(cookies).toEqual(["better-auth.session_token=; Path=/; Max-Age=0; HttpOnly"])
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/auth/sign-out",
    )
  })

  test("loads the beta A2UI surface through the shared runtime client helper", async () => {
    const surface = await getRuntimeReportGenUiBetaSurface("alanpcurrie-landscape")

    expect(surface?.root).toBe("surface-root")
    expect(surface?.data.title).toBe("Pressure summary")
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/reports/alanpcurrie-landscape/gen-ui-beta-surface",
    )
  })
})

describe("runtime client landscape repository paths", () => {
  test("encodes contributor emails with ingress-safe route segments", async () => {
    const contributor = await getRuntimeReportContributorDetail(
      "better-auth.session_token=abc",
      "alanpcurrie-landscape",
      "alan@example.com",
    )

    expect(contributor?.email).toBe("alan@example.com")
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/reports/alanpcurrie-landscape/contributors/alan$40example.com",
    )
  })

  test("encodes slash-containing repo keys with ingress-safe route segments", async () => {
    const repository = await getRuntimeReportLandscapeRepository(
      "better-auth.session_token=abc",
      "alanpcurrie-landscape",
      "alanpcurrie/next-app-playground",
    )

    expect(repository?.repoKey).toBe("alanpcurrie/next-app-playground")
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/reports/alanpcurrie-landscape/repositories/alanpcurrie$2Fnext-app-playground",
    )
  })

  test("encodes repository contributor emails in nested request URLs with ingress-safe route segments", async () => {
    const contributor = await getRuntimeReportLandscapeRepositoryContributorDetail(
      "better-auth.session_token=abc",
      "alanpcurrie-landscape",
      "alanpcurrie/next-app-playground",
      "alan@example.com",
    )

    expect(contributor?.email).toBe("alan@example.com")
    expect(getRequestUrl(fetchMock.mock.calls[0]![0] as string | URL | Request)).toBe(
      "http://example.test/api/reports/alanpcurrie-landscape/repositories/alanpcurrie$2Fnext-app-playground/contributors/alan$40example.com",
    )
  })
})
