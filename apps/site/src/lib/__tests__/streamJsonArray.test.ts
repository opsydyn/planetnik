import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { streamJsonArrayObjects } from "../datasets/streamJsonArray.js"

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(value: string): string {
  const root = mkdtempSync(join(tmpdir(), "planetnik-stream-json-"))
  roots.push(root)
  const path = join(root, "fixture.json")
  writeFileSync(path, value)
  return path
}

async function collect(path: string, key: string, highWaterMark: number): Promise<readonly unknown[]> {
  const records: unknown[] = []
  for await (const entry of streamJsonArrayObjects(path, key, { highWaterMark })) records.push(entry)
  return records
}

describe("streamJsonArrayObjects", () => {
  test("frames nested objects and escaped strings across one-byte chunks", async () => {
    const path = fixture(
      JSON.stringify({
        title: "stream",
        records: [
          { id: "a{b}", nested: { values: [1, 2] } },
          { id: "b", text: 'quote \\" and closing ] brace }' },
        ],
        other: [],
      }),
    )

    expect(await collect(path, "records", 1)).toEqual([
      { index: 0, value: { id: "a{b}", nested: { values: [1, 2] } } },
      { index: 1, value: { id: "b", text: 'quote \\" and closing ] brace }' } },
    ])
  })

  test("supports empty arrays and rejects a scalar array member", async () => {
    const empty = fixture('{"records":[],"tail":{"ok":true}}')
    expect(await collect(empty, "records", 17)).toEqual([])

    const scalar = fixture('{"records":[{"id":"ok"},3]}')
    await expect(collect(scalar, "records", 2)).rejects.toThrow("must contain only object records")
  })

  test("fails closed for missing, duplicate, and malformed target arrays", async () => {
    await expect(collect(fixture('{"other":[]}'), "records", 4)).rejects.toThrow("array 'records' was not found")
    await expect(collect(fixture('{"records":[],"records":[]}'), "records", 4)).rejects.toThrow(
      "duplicate top-level array key 'records'",
    )
    await expect(collect(fixture('{"records":[{"id":"broken"}'), "records", 3)).rejects.toThrow(
      "unterminated JSON document",
    )
  })

  test("rejects an invalid object member and malformed UTF-8", async () => {
    await expect(collect(fixture('{"records":[{"id":}]}'), "records", 5)).rejects.toThrow("invalid object record")
    const path = fixture('{"records":[]}' + "\u0000")
    writeFileSync(
      path,
      Buffer.from([
        0x7b, 0x22, 0x72, 0x65, 0x63, 0x6f, 0x72, 0x64, 0x73, 0x22, 0x3a, 0x5b, 0x5d, 0x2c, 0xc3, 0x28, 0x7d,
      ]),
    )
    await expect(collect(path, "records", 4)).rejects.toThrow("invalid UTF-8")
  })
})
