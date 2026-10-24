import { describe, expect, test } from "bun:test"
import { resolveCodeCityEvidenceHref } from "../evidence.js"

describe("resolveCodeCityEvidenceHref", () => {
  test("returns null for a missing evidence route", () => {
    expect(resolveCodeCityEvidenceHref("/planetnik/", null)).toBeNull()
  })

  test("joins a deployment base and relative report route without an origin or double slash", () => {
    expect(resolveCodeCityEvidenceHref("/planetnik/", "/files/size#file-id")).toBe("/planetnik/files/size#file-id")
  })

  test("normalises redundant path separators and removes traversal segments", () => {
    expect(resolveCodeCityEvidenceHref("//planetnik//", "//files/../files//size#file-id")).toBe(
      "/planetnik/files/size#file-id",
    )
  })

  test("does not allow a route to escape the report base", () => {
    expect(resolveCodeCityEvidenceHref("/planetnik/", "../../outside#evidence")).toBe("/planetnik/outside#evidence")
  })

  test("normalises percent-encoded dot segments before joining the report base", () => {
    expect(resolveCodeCityEvidenceHref("/planetnik/", "%2e%2e/outside#evidence")).toBe("/planetnik/outside#evidence")
  })

  test("normalises backslash-delimited traversal before joining the report base", () => {
    expect(resolveCodeCityEvidenceHref("/planetnik/", "..\\outside#evidence")).toBe("/planetnik/outside#evidence")
  })
})
