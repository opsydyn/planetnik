import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

const navigateMock = mock(async (_href: string) => undefined)

mock.module("astro:transitions/client", () => ({
  navigate: navigateMock,
}))

const { buildHostedIntelligenceHref, navigateToHostedIntelligencePage } = await import("./navigation.js")

describe("hosted intelligence navigation", () => {
  const originalWindow = globalThis.window

  beforeEach(() => {
    navigateMock.mockClear()

    if (typeof originalWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window")
      return
    }

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    if (typeof originalWindow === "undefined") {
      Reflect.deleteProperty(globalThis, "window")
      return
    }

    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    })
  })

  test("builds report-local hrefs", () => {
    expect(buildHostedIntelligenceHref("/reports/demo", "/hotspots")).toBe("/reports/demo/hotspots")
  })

  test("uses Astro client navigation for in-app route changes", async () => {
    await navigateToHostedIntelligencePage("/reports/demo", "/hotspots")

    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith("/reports/demo/hotspots")
  })

  test("falls back to location.assign when client navigation throws", async () => {
    const assignMock = mock((_href: string) => undefined)

    navigateMock.mockImplementationOnce(async () => {
      throw new Error("navigation failed")
    })

    Object.defineProperty(globalThis, "window", {
      value: {
        location: {
          assign: assignMock,
        },
      },
      configurable: true,
      writable: true,
    })

    await navigateToHostedIntelligencePage("/reports/demo", "/hotspots")

    expect(assignMock).toHaveBeenCalledTimes(1)
    expect(assignMock).toHaveBeenCalledWith("/reports/demo/hotspots")
  })
})
