// Ambient typing for Bun's compile-time asset embedding syntax
// (`import path from "*.wasm" with { type: "file" }`).
declare module "*.wasm" {
  const path: string
  export default path
}
