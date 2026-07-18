// Ambient typing for Bun's compile-time asset embedding syntax
// (`import path from "*.wasm" with { type: "file" }`), used by
// TreeSitterRustParser.ts so the two tree-sitter WASM binaries are embedded
// into `bun build --compile` executables instead of resolved from disk at
// runtime via require.resolve, which standalone binaries cannot see.
declare module "*.wasm" {
  const path: string
  export default path
}
