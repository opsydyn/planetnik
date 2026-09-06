import { describe, expect, test } from "bun:test"
import { getMetric, parseMetricsJson } from "../metrics.js"

describe("canonical metrics reader", () => {
  test("reads metric records from the JSON shard shape", () => {
    const metrics = parseMetricsJson({
      title: "Metrics",
      metrics: [
        { id: "LINES_OF_CODE_MAIN", value: 18450 },
        { id: "NUMBER_OF_FILES_MAIN", value: 128 },
      ],
    })

    expect(metrics).toEqual([
      { id: "LINES_OF_CODE_MAIN", value: 18450 },
      { id: "NUMBER_OF_FILES_MAIN", value: 128 },
    ])
    expect(getMetric(metrics, "LINES_OF_CODE_MAIN")).toBe(18450)
  })

  test("ignores malformed records and non-JSON input", () => {
    expect(
      parseMetricsJson({
        metrics: [{ id: "VALID", value: 1 }, { id: "missing-value" }, { id: "nan", value: Number.NaN }, "METRIC: 99"],
      }),
    ).toEqual([{ id: "VALID", value: 1 }])
    expect(parseMetricsJson("METRIC: 99\n")).toEqual([])
  })
})
