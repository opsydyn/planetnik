import { describe, expect, test } from "bun:test"
import { NamedSourceCodeAspect } from "../../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../../aspects/SourceFile.js"
import { DependencyUtils } from "../../dependencies/DependencyUtils.js"
import { HaskellAnalyzer } from "../HaskellAnalyzer.js"

describe("HaskellAnalyzer dependency extraction", () => {
  test("extracts internal dependencies from import declarations", () => {
    const analyzer = new HaskellAnalyzer()

    const appFile = new SourceFile(
      "src/My/App.hs",
      [
        "module My.App where",
        "import qualified My.Domain.User as User",
        'import "pkg" My.Util.Text (render)',
        "import Data.Text (Text)",
        "run = User.load",
      ].join("\n"),
    )
    appFile.linesOfCode = 5
    const appComponent = new NamedSourceCodeAspect("app")
    appComponent.filtering = "primary"
    appFile.logicalComponents.push(appComponent)

    const domainFile = new SourceFile("src/My/Domain/User.hs", "module My.Domain.User where\nload = pure ()")
    domainFile.linesOfCode = 2
    const domainComponent = new NamedSourceCodeAspect("domain")
    domainComponent.filtering = "primary"
    domainFile.logicalComponents.push(domainComponent)

    const utilFile = new SourceFile("src/My/Util/Text.hs", "module My.Util.Text where\nrender = id")
    utilFile.linesOfCode = 2
    const utilComponent = new NamedSourceCodeAspect("util")
    utilComponent.filtering = "primary"
    utilFile.logicalComponents.push(utilComponent)

    const analysis = analyzer.extractDependencies([appFile, domainFile, utilFile])

    expect(analysis.dependencies).toHaveLength(2)
    expect(analysis.dependencies.map((dependency) => dependency.to.anchor).sort()).toEqual([
      "My.Domain.User",
      "My.Util.Text",
    ])

    const componentDependencies = DependencyUtils.getComponentDependencies(analysis.dependencies, "primary")

    expect(componentDependencies).toHaveLength(2)
    expect(
      componentDependencies.map((dependency) => `${dependency.fromComponent}->${dependency.toComponent}`).sort(),
    ).toEqual(["app->domain", "app->util"])
  })

  test("supports inferred module names and literate import lines", () => {
    const analyzer = new HaskellAnalyzer()

    const appFile = new SourceFile(
      "app/Main.lhs",
      ["> import Internal.Helpers", "> import Data.Text as Text", "> main = print helper"].join("\n"),
    )

    const helperFile = new SourceFile("src/Internal/Helpers.hs", "helper = 1")

    const analysis = analyzer.extractDependencies([appFile, helperFile])

    expect(analysis.dependencies).toHaveLength(1)
    expect(analysis.dependencies[0]?.from.anchor).toBe("Main")
    expect(analysis.dependencies[0]?.to.anchor).toBe("Internal.Helpers")
    expect(analysis.dependencies[0]?.fromFiles[0]?.codeFragment).toBe("import Internal.Helpers")
  })
})

describe("HaskellAnalyzer unit extraction", () => {
  test("extracts top-level functions with signatures and guards while ignoring nested where bindings", () => {
    const analyzer = new HaskellAnalyzer()

    const sourceFile = new SourceFile(
      "src/Sample.hs",
      [
        "module Sample where",
        "",
        "add :: Int -> Int -> Int",
        "add x y =",
        "  x + y",
        "",
        "describe x",
        '  | x > 0 = "positive"',
        "  | otherwise = helper",
        "  where",
        '    helper = "negative"',
      ].join("\n"),
    )

    const units = analyzer.extractUnits(sourceFile)

    expect(units.map((unit) => unit.shortName)).toEqual(["add", "describe"])
    expect(units.some((unit) => unit.shortName === "helper")).toBe(false)

    const addUnit = units[0]!
    expect(addUnit.longName).toContain("add :: Int -> Int -> Int")
    expect(addUnit.numberOfParameters).toBe(2)

    const describeUnit = units[1]!
    expect(describeUnit.numberOfParameters).toBe(1)
    expect(describeUnit.mcCabeIndex).toBeGreaterThanOrEqual(3)
    expect(describeUnit.cleanedBody).not.toContain("negative")
  })

  test("extracts top-level type and class declarations as units", () => {
    const analyzer = new HaskellAnalyzer()

    const sourceFile = new SourceFile(
      "src/Domain.hs",
      ["data Person a = Person a", "", "class Renderable a where", "  render :: a -> String"].join("\n"),
    )

    const units = analyzer.extractUnits(sourceFile)

    expect(units.map((unit) => unit.shortName)).toEqual(["Person", "Renderable"])
    expect(units[0]?.numberOfParameters).toBe(1)
    expect(units[1]?.numberOfParameters).toBe(1)
    expect(units[1]?.longName).toBe("class Renderable a where")
  })
})
