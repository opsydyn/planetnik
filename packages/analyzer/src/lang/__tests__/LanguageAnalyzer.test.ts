import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../aspects/SourceFile"
import { DefaultLanguageAnalyzer } from "../DefaultLanguageAnalyzer"
import { GoLangAnalyzer } from "../GoLangAnalyzer"
import { JavaAnalyzer } from "../JavaAnalyzer"
import { JavaScriptAnalyzer } from "../JavaScriptAnalyzer"
import { LanguageAnalyzerFactory } from "../LanguageAnalyzerFactory"
import { PythonAnalyzer } from "../PythonAnalyzer"
import { TypeScriptAnalyzer } from "../TypeScriptAnalyzer"

describe("LanguageAnalyzerFactory", () => {
  const factory = LanguageAnalyzerFactory.getInstance()

  test("returns JavaAnalyzer for .java", () => {
    expect(factory.getLanguageAnalyzerByExtension("java")).toBeInstanceOf(JavaAnalyzer)
  })

  test("returns JavaScriptAnalyzer for .js", () => {
    expect(factory.getLanguageAnalyzerByExtension("js")).toBeInstanceOf(JavaScriptAnalyzer)
  })

  test("returns TypeScriptAnalyzer for .ts", () => {
    expect(factory.getLanguageAnalyzerByExtension("ts")).toBeInstanceOf(TypeScriptAnalyzer)
  })

  test("returns PythonAnalyzer for .py", () => {
    expect(factory.getLanguageAnalyzerByExtension("py")).toBeInstanceOf(PythonAnalyzer)
  })

  test("returns GoLangAnalyzer for .go", () => {
    expect(factory.getLanguageAnalyzerByExtension("go")).toBeInstanceOf(GoLangAnalyzer)
  })

  test("returns DefaultLanguageAnalyzer for unknown extension", () => {
    expect(factory.getLanguageAnalyzerByExtension("unknown")).toBeInstanceOf(DefaultLanguageAnalyzer)
  })

  test("case insensitive extension matching", () => {
    expect(factory.getLanguageAnalyzerByExtension("JAVA")).toBeInstanceOf(JavaAnalyzer)
  })
})

describe("JavaAnalyzer cleaning", () => {
  const analyzer = new JavaAnalyzer()

  test("removes single line comments", () => {
    const sf = new SourceFile("Test.java", "int x = 1; // comment\nint y = 2;")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)
    expect(cleaned.cleanedContent).not.toContain("comment")
    expect(cleaned.cleanedContent).toContain("int x = 1;")
  })

  test("removes block comments", () => {
    const sf = new SourceFile("Test.java", "/* block\ncomment */\nint x = 1;")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)
    expect(cleaned.cleanedContent).toContain("int x = 1;")
    expect(cleaned.getCleanedLinesCount()).toBe(1)
  })

  test("removes empty lines", () => {
    const sf = new SourceFile("Test.java", "int x = 1;\n\n\nint y = 2;")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)
    expect(cleaned.getCleanedLinesCount()).toBe(2)
  })
})

describe("PythonAnalyzer cleaning", () => {
  const analyzer = new PythonAnalyzer()

  test("removes hash comments", () => {
    const sf = new SourceFile("test.py", "x = 1 # comment\ny = 2")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)
    expect(cleaned.cleanedContent).not.toContain("comment")
  })

  test("removes docstring comments", () => {
    const sf = new SourceFile("test.py", '"""\ndocstring\n"""\nx = 1')
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)
    expect(cleaned.getCleanedLinesCount()).toBe(1)
  })
})

describe("Unit extraction", () => {
  test("extracts Java method units", () => {
    const code = `public class Foo {
  public void doSomething(int x) {
    if (x > 0) {
      System.out.println(x);
    }
  }

  public int getValue() {
    return 42;
  }
}`
    const sf = new SourceFile("Foo.java", code)
    sf.cleanedLines = code.split("\n").filter((l) => l.trim().length > 0)
    const analyzer = new JavaAnalyzer()
    const units = analyzer.extractUnits(sf)
    expect(units.length).toBeGreaterThanOrEqual(2)
  })

  test("calculates McCabe complexity", () => {
    const code = `public void complex(int x) {
  if (x > 0) {
    for (int i = 0; i < x; i++) {
      if (i % 2 == 0 && x > 10) {
        doSomething();
      }
    }
  }
}`
    const sf = new SourceFile("Test.java", code)
    sf.cleanedLines = code.split("\n").filter((l) => l.trim().length > 0)
    const analyzer = new JavaAnalyzer()
    const units = analyzer.extractUnits(sf)
    expect(units.length).toBe(1)
    // Base 1 + if + for + if + && = 5
    expect(units[0]!.mcCabeIndex).toBeGreaterThanOrEqual(4)
  })
})
