import { describe, expect, test } from "bun:test"
import type { AppConfig } from "../config.js"

function loadConfig(overrides: Record<string, string | undefined> = {}) {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--no-env-file",
      "--eval",
      'import { appConfig } from "./src/config.ts"; console.log(JSON.stringify(appConfig))',
    ],
    {
      cwd: new URL("../../", import.meta.url).pathname,
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://test:test@localhost:5432/planetnik",
        BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters",
        BETTER_AUTH_URL: "http://localhost:1337",
        NODE_ENV: undefined,
        PORT: undefined,
        CORS_ORIGIN: undefined,
        PLANETNIK_DATASETS_ROOT: undefined,
        COOKIE_DOMAIN: undefined,
        AUTH_COOKIE_SECURE: undefined,
        AUTH_COOKIE_SAME_SITE: undefined,
        ...overrides,
      },
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString(),
    error: result.stderr.toString(),
  }
}

describe("runtime configuration", () => {
  test("keeps development defaults and optional settings absent", () => {
    const result = loadConfig()
    expect(result.exitCode).toBe(0)
    const config = JSON.parse(result.output) as AppConfig
    expect(config.nodeEnv).toBe("development")
    expect(config.port).toBe(1337)
    expect(config.corsOrigins).toEqual(["http://localhost:4321", "http://127.0.0.1:4321"])
    expect(config.authCookies).toEqual({ secure: false, sameSite: "lax" })
    expect(config).not.toHaveProperty("datasetsRoot")
    expect(config).not.toHaveProperty("cookieDomain")
  })

  test("normalizes production settings without adding development origins", () => {
    const result = loadConfig({
      NODE_ENV: " PRODUCTION ",
      PORT: "1443",
      CORS_ORIGIN: " https://app.example.com, https://report.example.com ",
      PLANETNIK_DATASETS_ROOT: " /datasets ",
      COOKIE_DOMAIN: " .example.com ",
      AUTH_COOKIE_SAME_SITE: " NONE ",
    })
    expect(result.exitCode).toBe(0)
    const config = JSON.parse(result.output) as AppConfig
    expect(config.nodeEnv).toBe("production")
    expect(config.port).toBe(1443)
    expect(config.authCookies).toEqual({ secure: true, sameSite: "none" })
    expect(config.corsOrigins).toEqual(["https://app.example.com", "https://report.example.com"])
    expect(config.datasetsRoot).toBe("/datasets")
    expect(config.cookieDomain).toBe(".example.com")
  })

  test("downgrades SameSite none when secure cookies are disabled", () => {
    const result = loadConfig({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false", AUTH_COOKIE_SAME_SITE: "none" })
    expect(result.exitCode).toBe(0)
    expect((JSON.parse(result.output) as AppConfig).authCookies).toEqual({ secure: false, sameSite: "lax" })
  })

  for (const [name, value] of [
    ["NODE_ENV", "staging"],
    ["AUTH_COOKIE_SAME_SITE", "invalid"],
    ["AUTH_COOKIE_SECURE", "invalid"],
    ["PORT", "65536"],
    ["DATABASE_URL", ""],
    ["BETTER_AUTH_SECRET", ""],
  ] as const) {
    test(`rejects invalid ${name}`, () => {
      expect(loadConfig({ [name]: value }).exitCode).not.toBe(0)
    })
  }
})
