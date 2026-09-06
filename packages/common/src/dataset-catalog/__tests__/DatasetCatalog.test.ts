import { describe, expect, test } from "bun:test"
import { type DatasetDescriptor, decodeDatasetCatalog, decodeDatasetDescriptor } from "../DatasetCatalog.js"

const readyDescriptor = (): DatasetDescriptor => ({
  id: "requests-python-pilot",
  slug: "requests-python-pilot",
  title: "Requests Python Tree-sitter Pilot",
  mode: "single_repository",
  snapshot: {
    snapshotId: "3d611736-9df1-4d22-a93e-00d06b13e767",
    dataVersion: 2,
    generatedAt: "2026-09-03T21:08:09.001Z",
  },
  provenance: {
    sourceUrl: "https://github.com/psf/requests",
    sourceRef: "main",
    license: "Apache-2.0",
  },
  description: "Python parser pilot over a small public repository snapshot.",
  stats: {
    repositories: 1,
    files: 39,
    loc: 9875,
    units: 807,
    contributors: 3,
    commits: 42,
    dependencies: 102,
  },
  languages: [{ key: "py", label: "Python", loc: 9841, share: 99.7 }],
  capabilities: ["summary", "code-city"],
  tags: ["python", "pilot"],
  curation: { featured: true, shelf: "Repository pilots", order: 10 },
  availability: "ready",
})

describe("Dataset catalogue contract", () => {
  test("decodes a valid ready descriptor and preserves snapshot facts", () => {
    const descriptor = decodeDatasetDescriptor(readyDescriptor())

    expect(descriptor.id).toBe("requests-python-pilot")
    expect(descriptor.snapshot?.dataVersion).toBe(2)
    expect(descriptor.stats.loc).toBe(9875)
  })

  test("allows a planned recommendation without a snapshot", () => {
    const planned = decodeDatasetDescriptor({
      ...readyDescriptor(),
      snapshot: undefined,
      availability: "planned",
      stats: {},
      curation: { featured: false, shelf: "Coming soon", order: 100 },
    })

    expect(planned.availability).toBe("planned")
    expect(planned.snapshot).toBeUndefined()
  })

  test("rejects a non-planned descriptor without a snapshot", () => {
    expect(() =>
      decodeDatasetDescriptor({
        ...readyDescriptor(),
        snapshot: undefined,
        availability: "ready",
      }),
    ).toThrow(/snapshot/i)
  })

  test("rejects unsafe IDs, malformed snapshot IDs, and invalid language shares", () => {
    for (const input of [
      { ...readyDescriptor(), id: "../escape" },
      {
        ...readyDescriptor(),
        snapshot: {
          ...readyDescriptor().snapshot,
          snapshotId: "not-a-uuid",
        },
      },
      {
        ...readyDescriptor(),
        languages: [{ key: "py", label: "Python", loc: 10, share: 120 }],
      },
    ]) {
      expect(() => decodeDatasetDescriptor(input)).toThrow()
    }
  })

  test("rejects duplicate IDs or slugs in a catalogue", () => {
    const first = readyDescriptor()
    const second = { ...readyDescriptor(), title: "Another title" }

    expect(() => decodeDatasetCatalog({ catalogVersion: 1, datasets: [first, second] })).toThrow(/duplicate/i)
  })

  test("sorts descriptors by curation order and stable ID", () => {
    const alpha = {
      ...readyDescriptor(),
      id: "alpha",
      slug: "alpha",
      curation: { featured: false, shelf: "Repository pilots", order: 20 },
    }
    const beta = {
      ...readyDescriptor(),
      id: "beta",
      slug: "beta",
      curation: { featured: false, shelf: "Repository pilots", order: 20 },
    }

    const catalog = decodeDatasetCatalog({
      catalogVersion: 1,
      datasets: [beta, alpha],
    })

    expect(catalog.datasets.map((entry) => entry.id)).toEqual(["alpha", "beta"])
  })
})
