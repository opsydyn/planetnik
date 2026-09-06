import { afterAll, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const roots: string[] = []
const dataModulePath = fileURLToPath(new URL("../data.ts", import.meta.url))

function createDataDir(): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-copilot-data-"))
  const dataDir = join(root, "data")
  mkdirSync(dataDir, { recursive: true })
  roots.push(root)
  return dataDir
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2))
}

async function readContributors(dataDir: string): Promise<unknown> {
  const script = `import { getContributors } from ${JSON.stringify(dataModulePath)}; console.log(JSON.stringify(getContributors()));`
  const child = Bun.spawn([process.execPath, "-e", script], {
    env: { ...process.env, PLANETNIK_DATA_DIR: dataDir },
    stderr: "pipe",
    stdout: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  if (exitCode !== 0) {
    throw new Error(`Copilot data child exited with ${exitCode}: ${stderr}`)
  }
  return JSON.parse(stdout)
}

afterAll(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

test("reads contributors.json and ignores a conflicting TXT projection", async () => {
  const dataDir = createDataDir()
  writeJson(join(dataDir, "contributors.json"), { legacyContributors: [] })
  writeFileSync(
    join(dataDir, "contributors.txt"),
    "email\tall_time\t30d\t90d\t180d\t365d\tfirst\tlast\ntext@example.com\t1\t1\t1\t1\t1\t2025-01-01\t2025-01-02\n",
  )

  expect(await readContributors(dataDir)).toEqual([])
})

test("returns no contributors when the canonical JSON shard is absent", async () => {
  const dataDir = createDataDir()
  writeFileSync(
    join(dataDir, "contributors.txt"),
    "email\tall_time\t30d\t90d\t180d\t365d\tfirst\tlast\ntext@example.com\t1\t1\t1\t1\t1\t2025-01-01\t2025-01-02\n",
  )

  expect(await readContributors(dataDir)).toEqual([])
})
