import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import ReportDataGridInner from "../../../../../packages/report-ui/src/tables/ReportDataGridInner.js"
import SiteReportDataGridInner from "../../components/tables/ReportDataGridInner.js"

describe.each([
  ["shared", ReportDataGridInner],
  ["site", SiteReportDataGridInner],
] as const)("%s ReportDataGridInner", (_name, Grid) => {
  test("sorts before pagination and renders the configured row range", () => {
    const html = renderToStaticMarkup(
      <Grid
        rows={[{ name: "item10" }, { name: "item2" }, { name: "item1" }]}
        columns={[{ field: "name", headerName: "Name", sort: "asc" }]}
        paginationPageSize={2}
      />,
    )

    expect(html).toContain("1 to 2 of 3. Page 1 of 2")
    expect(html.indexOf("item1")).toBeLessThan(html.indexOf("item2"))
    expect(html).not.toContain("item10")
    expect(html).toContain("Column filters")
  })

  test("renders the empty state without table rows", () => {
    const html = renderToStaticMarkup(
      <Grid rows={[]} columns={[{ field: "name", headerName: "Name" }]} emptyMessage="No matches" />,
    )
    expect(html).toContain("No matches")
    expect(html).not.toContain("<tbody>")
  })
})

describe("shared report dates", () => {
  test("keeps date normalization, initial sorting, and link rendering", () => {
    const html = renderToStaticMarkup(
      <ReportDataGridInner
        rows={[
          { date: "2026-10-24T10:00:00Z", name: "Later", href: "/later" },
          { date: "2026-01-02", name: "Earlier", href: "/earlier" },
        ]}
        columns={[
          { field: "name", headerName: "Name", type: "link", hrefField: "href" },
          { field: "date", headerName: "Date", type: "date", sort: "asc" },
        ]}
      />,
    )

    expect(html.indexOf('href="/earlier"')).toBeLessThan(html.indexOf('href="/later"'))
    expect(html).toContain("2026-01-02")
    expect(html).not.toContain("T10:00:00Z")
  })
})
