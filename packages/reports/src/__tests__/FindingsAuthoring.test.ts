import { describe, expect, test } from "bun:test"
import {
  findingsMarkdownToText,
  normalizeFindingsAuthoringDocument,
  parseFindingsAuthoringDocument,
  renderFindingsMarkdownToHtml,
} from "../findings/FindingsAuthoring.js"

describe("findings authoring", () => {
  test("accepts an empty canonical document without inventing a finding", () => {
    expect(normalizeFindingsAuthoringDocument(parseFindingsAuthoringDocument({ items: [] }))).toEqual({
      title: "Notes & Findings",
      items: [],
    })
  })

  test("normalizes stable structured findings with derived presentation fields", () => {
    const document = parseFindingsAuthoringDocument(
      {
        title: "Architecture notes",
        items: [
          {
            id: "validation-gap",
            summary: "Validation gap",
            body: "**Checkout** skips validation.\n\nReview the fallback.",
          },
        ],
      },
      "/tmp/findings.json",
    )

    expect(normalizeFindingsAuthoringDocument(document)).toEqual({
      title: "Architecture notes",
      items: [
        {
          id: "validation-gap",
          summary: "Validation gap",
          bodyMarkdown: "**Checkout** skips validation.\n\nReview the fallback.",
          bodyHtml: "<p><strong>Checkout</strong> skips validation.</p><p>Review the fallback.</p>",
          bodyText: "Checkout skips validation. Review the fallback.",
        },
      ],
    })
  })

  test("rejects missing fields and duplicate IDs with source context", () => {
    expect(() =>
      parseFindingsAuthoringDocument(
        {
          items: [
            { id: "same", summary: "One", body: "First" },
            { id: "same", summary: "Two", body: "Second" },
          ],
        },
        "project/findings.json",
      ),
    ).toThrow('duplicate finding id "same"')

    expect(() =>
      parseFindingsAuthoringDocument({ items: [{ id: "missing-summary", body: "Body" }] }, "project/findings.json"),
    ).toThrow("item 1 requires a non-empty summary")
  })

  test("renders Markdown as escaped HTML and searchable text", () => {
    const markdown = "# Review\n\n- **Checkout**\n- `fallback`\n\n<script>alert(1)</script>"

    expect(renderFindingsMarkdownToHtml(markdown)).toBe(
      "<h1>Review</h1><ul><li><strong>Checkout</strong></li><li><code>fallback</code></li></ul><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    )
    expect(findingsMarkdownToText(markdown)).toBe("Review Checkout fallback <script>alert(1)</script>")
  })
})
