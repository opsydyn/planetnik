import { describe, expect, test } from "bun:test"
import { SourceFile } from "../../../aspects/SourceFile.js"
import { PythonAnalyzer } from "../../PythonAnalyzer.js"

describe("PythonAnalyzer Tree-sitter dependency extraction", () => {
  test("links internal absolute and relative imports while ignoring external modules", () => {
    const serviceFile = new SourceFile(
      "src/pkg/service.py",
      [
        "import json",
        "import pkg.models as models",
        "from .helpers import format_value",
        "from requests import get",
        "",
        "def serve():",
        "    return format_value(models.User())",
      ].join("\n"),
    )
    const helpersFile = new SourceFile("src/pkg/helpers.py", "def format_value(value):\n    return str(value)")
    const modelsFile = new SourceFile("src/pkg/models.py", "class User:\n    pass")

    const analysis = new PythonAnalyzer().extractDependencies([serviceFile, helpersFile, modelsFile])

    expect(analysis.dependencies).toHaveLength(2)
    expect(
      analysis.dependencies.map((dependency) => `${dependency.from.anchor}->${dependency.to.anchor}`).sort(),
    ).toEqual(["pkg.service->pkg.helpers", "pkg.service->pkg.models"])
    expect(analysis.dependencies.every((dependency) => (dependency.fromFiles[0]?.codeFragment.length ?? 0) > 0)).toBe(
      true,
    )
  })

  test("does not treat a regular module as a package prefix", () => {
    const appFile = new SourceFile("src/app.py", "import pkg.external\n")
    const moduleFile = new SourceFile("src/pkg.py", "value = 1\n")

    const analysis = new PythonAnalyzer().extractDependencies([appFile, moduleFile])

    expect(analysis.dependencies).toHaveLength(0)
  })
})
