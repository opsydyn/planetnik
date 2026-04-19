import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../aspects/SourceFile"
import { CssAnalyzer } from "../CssAnalyzer"
import { DefaultLanguageAnalyzer } from "../DefaultLanguageAnalyzer"
import { GoLangAnalyzer } from "../GoLangAnalyzer"
import { HaskellAnalyzer } from "../HaskellAnalyzer"
import { HtmlAnalyzer } from "../HtmlAnalyzer"
import { JavaAnalyzer } from "../JavaAnalyzer"
import { JavaScriptAnalyzer } from "../JavaScriptAnalyzer"
import { JsonAnalyzer } from "../JsonAnalyzer"
import { LanguageAnalyzerFactory } from "../LanguageAnalyzerFactory"
import { PythonAnalyzer } from "../PythonAnalyzer"
import { RubyAnalyzer } from "../RubyAnalyzer"
import { ShellAnalyzer } from "../ShellAnalyzer"
import { SqlAnalyzer } from "../SqlAnalyzer"
import { TypeScriptAnalyzer } from "../TypeScriptAnalyzer"
import { XmlAnalyzer } from "../XmlAnalyzer"
import { YamlAnalyzer } from "../YamlAnalyzer"

describe("LanguageAnalyzerFactory", () => {
  const factory = LanguageAnalyzerFactory.getInstance()

  test("returns JavaAnalyzer for .java", () => {
    expect(factory.getLanguageAnalyzerByExtension("java")).toBeInstanceOf(JavaAnalyzer)
  })

  test("returns JavaScriptAnalyzer for .js", () => {
    expect(factory.getLanguageAnalyzerByExtension("js")).toBeInstanceOf(JavaScriptAnalyzer)
  })

  test("returns HtmlAnalyzer for .jsx", () => {
    expect(factory.getLanguageAnalyzerByExtension("jsx")).toBeInstanceOf(HtmlAnalyzer)
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

  test("returns HaskellAnalyzer for Haskell source extensions", () => {
    expect(factory.getLanguageAnalyzerByExtension("hs")).toBeInstanceOf(HaskellAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("lhs")).toBeInstanceOf(HaskellAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("hsig")).toBeInstanceOf(HaskellAnalyzer)
  })

  test("returns markup and config analyzers for newly ported families", () => {
    expect(factory.getLanguageAnalyzerByExtension("html")).toBeInstanceOf(HtmlAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("xml")).toBeInstanceOf(XmlAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("jsonc")).toBeInstanceOf(JsonAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("yml")).toBeInstanceOf(YamlAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("sh")).toBeInstanceOf(ShellAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("sql")).toBeInstanceOf(SqlAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("css")).toBeInstanceOf(CssAnalyzer)
  })

  test("includes broader Sokrates extension aliases", () => {
    expect(factory.getLanguageAnalyzerByExtension("gyp")).toBeInstanceOf(PythonAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("thor")).toBeInstanceOf(RubyAnalyzer)
    expect(factory.getLanguageAnalyzerByExtension("xsjslib")).toBeInstanceOf(JavaScriptAnalyzer)
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

describe("Newly ported language analyzers", () => {
  test("HtmlAnalyzer removes comments and closing tags from duplication cleaning", () => {
    const analyzer = new HtmlAnalyzer()
    const sf = new SourceFile("index.html", "<div>\n  <!-- comment -->\n</div>\n")
    const loc = analyzer.cleanForLinesOfCodeCalculations(sf)
    const duplication = analyzer.cleanForDuplicationCalculations(sf)

    expect(loc.cleanedContent).not.toContain("comment")
    expect(duplication.cleanedContent).not.toContain("</div>")
  })

  test("XmlAnalyzer removes XML comments and keeps CDATA intact", () => {
    const analyzer = new XmlAnalyzer()
    const sf = new SourceFile("feed.xml", "<!-- comment -->\n<item><![CDATA[<raw/>]]></item>")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent).not.toContain("comment")
    expect(cleaned.cleanedContent).toContain("<![CDATA[]]>")
  })

  test("JsonAnalyzer strips braces in duplication cleaning", () => {
    const analyzer = new JsonAnalyzer()
    const sf = new SourceFile("data.json", '{\n  "name": "planetnik"\n}')
    const cleaned = analyzer.cleanForDuplicationCalculations(sf)

    expect(cleaned.cleanedContent).toContain('"name": "planetnik"')
    expect(cleaned.cleanedContent).not.toContain("{")
    expect(cleaned.cleanedContent).not.toContain("}")
  })

  test("YamlAnalyzer removes hash comments", () => {
    const analyzer = new YamlAnalyzer()
    const sf = new SourceFile("config.yml", "name: planetnik # comment\nmode: strict")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent).not.toContain("comment")
    expect(cleaned.getCleanedLinesCount()).toBe(2)
  })

  test("ShellAnalyzer removes hash comments", () => {
    const analyzer = new ShellAnalyzer()
    const sf = new SourceFile("script.sh", "echo hi # comment\nexport APP=1")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent).not.toContain("comment")
  })

  test("SqlAnalyzer removes SQL comments", () => {
    const analyzer = new SqlAnalyzer()
    const sf = new SourceFile("query.sql", "-- comment\nselect 1;\n/* block */")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent.toLowerCase()).toContain("select 1;")
    expect(cleaned.cleanedContent).not.toContain("comment")
  })

  test("CssAnalyzer removes block comments", () => {
    const analyzer = new CssAnalyzer()
    const sf = new SourceFile("styles.css", "/* comment */\n.button { color: red; }")
    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent).not.toContain("comment")
    expect(cleaned.cleanedContent).toContain(".button { color: red; }")
  })

  test("HaskellAnalyzer removes line and nested block comments", () => {
    const analyzer = new HaskellAnalyzer()
    const sf = new SourceFile(
      "Main.hs",
      'main = putStrLn "-- keep this" -- drop this\n{- outer\n  {- inner -}\n-}\nnext = 42',
    )

    const cleaned = analyzer.cleanForLinesOfCodeCalculations(sf)

    expect(cleaned.cleanedContent).toContain('main = putStrLn ""')
    expect(cleaned.cleanedContent).toContain("next = 42")
    expect(cleaned.cleanedContent).not.toContain("drop this")
    expect(cleaned.cleanedContent).not.toContain("outer")
    expect(cleaned.cleanedContent).not.toContain("inner")
  })

  test("HaskellAnalyzer keeps operator-like dashes in duplication cleaning", () => {
    const analyzer = new HaskellAnalyzer()
    const sf = new SourceFile("Operators.hs", "arrow = a --> b\nvalue = 1 -- comment")

    const cleaned = analyzer.cleanForDuplicationCalculations(sf)

    expect(cleaned.cleanedContent).toContain("arrow = a --> b")
    expect(cleaned.cleanedContent).toContain("value = 1")
    expect(cleaned.cleanedContent).not.toContain("comment")
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
