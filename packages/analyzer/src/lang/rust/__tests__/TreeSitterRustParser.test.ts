import { describe, expect, test } from "bun:test"
import { parseRustSource } from "../TreeSitterRustParser.js"

describe("TreeSitterRustParser", () => {
  test("parses a representative async Rust snippet without syntax errors", () => {
    const parsed = parseRustSource(`use tokio::net::TcpListener;

async fn main() -> Result<(), Box<dyn std::error::Error>> {
	let listener = TcpListener::bind("127.0.0.1:8080").await?;
	drop(listener);
	Ok(())
}`)

    try {
      const root = parsed.tree.rootNode
      expect(root.type).toBe("source_file")
      expect(root.hasError).toBe(false)

      const functionItem = root.namedChildren.find((child) => child.type === "function_item")

      expect(functionItem).toBeDefined()
      expect(functionItem?.childForFieldName("name")?.text).toBe("main")
    } finally {
      parsed.dispose()
    }
  })
})
