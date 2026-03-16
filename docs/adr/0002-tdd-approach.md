# ADR-0002: Test-Driven Development Approach

## Status

Accepted

## Context

We are porting ~607 Java files with existing test coverage. We need a development methodology that ensures correctness during the port.

## Decision

We will use **Test-Driven Development (TDD)** throughout the port:

1. **Red**: Write failing tests first, ported from Java JUnit tests or written to match Java behavior
2. **Green**: Implement the minimum code to pass
3. **Refactor**: Clean up while keeping tests green

### Test tooling

- `bun:test` as the primary test runner (built into Bun, fast, Jest-compatible API)
- Tests live alongside source in `__tests__/` directories or as `*.test.ts` files
- Each package has its own `bun test` script

### What gets tested

- All data models (Schema encode/decode roundtrip)
- Code cleaners (comment stripping, empty line removal)
- Duplication detection algorithms
- Unit extraction (function/method parsing)
- Language analyzer behavior (per-language)
- CLI command behavior (integration tests)
- Config compatibility (parse Java-generated `sokrates.json`)

## Consequences

- Slower initial velocity but higher confidence in correctness
- Tests serve as living documentation of Java behavior parity
- Regressions caught immediately during refactoring
