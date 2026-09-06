# Rust Tree-sitter Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Rust Tree-sitter coverage boundary with correct match-arm complexity and a provenance-free executable fixture matrix for supported and deliberately conservative syntax.

**Architecture:** Keep extraction syntax-first through the existing shared `TreeSitterRuntime`; correct only the Rust unit extractor's match-arm traversal and protect the behavior with focused tests. Store the broader coverage corpus as a checked-in JSON fixture consumed by the Rust analyzer tests, so future grammar or extractor changes must preserve both emitted facts and explicit exclusions.

**Tech Stack:** Bun, TypeScript, `web-tree-sitter`, `tree-sitter-rust`, Bun test, Biome.

**Spec:** `docs/product-roadmap.md` and `docs/rust-tree-sitter-migration-discovery.md` (Rust coverage hardening checklist).

## Global Constraints

- Keep Rust extraction syntax-backed and conservative; do not infer Cargo semantics, macro expansion, type resolution, or whole-program symbols.
- Preserve the existing `UnitInfo` shape and zero-based line ranges.
- Declaration-only trait and foreign signatures, and functions inside macro token trees, must remain excluded.
- Do not claim a runtime-executed Java Sokrates reference without an installed pinned Java/Maven toolchain.
- Do not commit or push in this slice.

---

### Task 1: Count nested Rust match arms in McCabe complexity

**Files:**
- Modify: `packages/analyzer/src/lang/rust/RustTreeSitterUnitsExtractor.ts`
- Test: `packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

**Interfaces:**
- Consumes: the existing syntax tree returned by `parseRustSource`.
- Produces: the existing `UnitInfo.mcCabeIndex`, with one contribution for each named `match_arm` under a Rust `match_block`.

- [x] **Step 1: Write the failing test**

Add a test with a `for`, `if`, `&&`, `||`, and a three-arm `match`, then assert the intended count:

```ts
test("counts match arms and boolean branches from syntax nodes", () => {
  const source = `fn classify(items: &[usize]) -> usize {
    let mut total = 0;
    for item in items {
      if *item > 0 && *item < 10 || *item == 42 {
        total += *item;
      }
    }
    match total {
      0 => 0,
      1..=3 => 1,
      _ => total,
    }
  }`

  const unit = new RustAnalyzer().extractUnits(new SourceFile("classify.rs", source))[0]

  expect(unit?.mcCabeIndex).toBe(8)
})
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `bun test packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

Expected: the new test fails with `received 6` because the current implementation looks for `match_arm` directly among `match_expression.namedChildren` instead of under `match_block`.

- [x] **Step 3: Implement the minimal fix**

Read the `match_block` child and count its named `match_arm` children, retaining the existing minimum-one behavior for malformed/partial syntax:

```ts
if (currentNode.type === "match_expression") {
  const matchBlock = currentNode.namedChildren.find((child) => child.type === "match_block")
  const matchArms = matchBlock?.namedChildren.filter((child) => child.type === "match_arm").length ?? 0
  count += Math.max(1, matchArms)
}
```

- [x] **Step 4: Run the focused test to verify it passes**

Run: `bun test packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

Expected: all Rust analyzer tests pass, including the new expected complexity of `8`.

- [x] **Step 5: Run the focused formatter and typecheck**

Run: `bunx biome check packages/analyzer/src/lang/rust/RustTreeSitterUnitsExtractor.ts packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts && bun run --cwd packages/analyzer typecheck`

Expected: no Biome diagnostics and analyzer typecheck exit code `0`.

---

### Task 2: Add an executable Rust syntax coverage matrix

**Files:**
- Create: `packages/analyzer/src/lang/rust/__tests__/fixtures/rust-tree-sitter-coverage-v1.json`
- Modify: `packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

**Interfaces:**
- Consumes: the JSON fixture's `source.content` and expected unit records.
- Produces: deterministic unit names, line ranges, parameter counts, complexity values, and explicit excluded names for the Rust syntax boundary.

- [x] **Step 1: Write the failing fixture-backed test**

Add a loader and test that reads `rust-tree-sitter-coverage-v1.json`, runs `RustAnalyzer.extractUnits`, and asserts the fixture contract:

```ts
const coverageFixture = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures", "rust-tree-sitter-coverage-v1.json"), "utf8"),
) as RustCoverageFixture

test("covers cfg, nested scopes, branch complexity, and conservative exclusions", () => {
  const units = new RustAnalyzer().extractUnits(
    new SourceFile(coverageFixture.source.relativePath, coverageFixture.source.content),
  )

  expect(units.map((unit) => ({
    shortName: unit.shortName,
    startLine: unit.startLine,
    endLine: unit.endLine,
    numberOfParameters: unit.numberOfParameters,
    mcCabeIndex: unit.mcCabeIndex,
  }))).toEqual(coverageFixture.expected.units)
  expect(units.map((unit) => unit.shortName)).not.toEqual(
    expect.arrayContaining(coverageFixture.expected.excludedUnitNames),
  )
})
```

- [x] **Step 2: Run the focused test to verify it fails**

Run: `bun test packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

Expected: the test fails because the new fixture file is not present yet.

- [x] **Step 3: Add the minimal versioned fixture**

The fixture source must include all of these real syntax cases in one file:

- a `#[cfg]`-gated async function;
- a trait with one declaration-only signature and one default method;
- an `impl Trait for Type` method and an inherent method with `if let`, `while let`, boolean operators, and a three-arm `match`;
- nested modules;
- an `extern "C"` declaration;
- a `macro_rules!` token tree containing a function-looking token sequence.

Record the exact current unit facts and list `Service::required`, `ffi`, and `generated` as excluded names. Keep the fixture self-contained and avoid external dependencies.

- [x] **Step 4: Run the fixture test to verify it passes**

Run: `bun test packages/analyzer/src/lang/rust/__tests__/RustAnalyzer.test.ts`

Expected: the focused Rust analyzer suite passes with deterministic fixture facts.

- [x] **Step 5: Update the coverage evidence**

Add the fixture name and the newly protected match-arm behavior to `docs/rust-tree-sitter-migration-discovery.md` and the Tree-sitter completeness section of `docs/product-roadmap.md`. Keep the Java capture explicitly open because the current host has no Java/Maven toolchain.

- [x] **Step 6: Run repository gates**

Run: `bun test packages/analyzer/src/lang/rust packages/analyzer/src/lang/tree-sitter && bun run typecheck && git diff --check`

Expected: focused Rust/runtime tests pass, root typecheck reports `0` errors, and the diff has no whitespace errors.

---

Plan complete and saved to `docs/superpowers/plans/2026-09-05-rust-tree-sitter-completeness.md`. Execute inline under the user's approval; stop before commit/push.
