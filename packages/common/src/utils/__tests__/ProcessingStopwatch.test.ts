import { beforeEach, describe, expect, test } from "bun:test"
import { ProcessingStopwatch, ProcessingTimes } from "../ProcessingStopwatch"

describe("ProcessingTimes", () => {
  test("records start time on construction", () => {
    const pt = new ProcessingTimes("test")
    expect(pt.processing).toBe("test")
    expect(pt.startMs).toBeGreaterThan(0)
  })

  test("end records end time", () => {
    const pt = new ProcessingTimes("test")
    pt.end()
    expect(pt.endMs).toBeGreaterThanOrEqual(pt.startMs)
  })

  test("getDurationMs returns difference", () => {
    const pt = new ProcessingTimes("test")
    pt.end()
    expect(pt.getDurationMs()).toBeGreaterThanOrEqual(0)
  })
})

describe("ProcessingStopwatch", () => {
  beforeEach(() => {
    ProcessingStopwatch.reset()
  })

  test("start and end records timing", () => {
    ProcessingStopwatch.start("task1")
    ProcessingStopwatch.end("task1")
    const monitors = ProcessingStopwatch.getMonitors()
    expect(monitors.length).toBe(1)
    expect(monitors[0]!.processing).toBe("task1")
  })

  test("startAsReference sets reference", () => {
    ProcessingStopwatch.startAsReference("main")
    ProcessingStopwatch.end("main")
    expect(ProcessingStopwatch.getMonitors().length).toBe(1)
  })

  test("reset clears all data", () => {
    ProcessingStopwatch.start("task1")
    ProcessingStopwatch.end("task1")
    ProcessingStopwatch.reset()
    expect(ProcessingStopwatch.getMonitors().length).toBe(0)
  })
})
