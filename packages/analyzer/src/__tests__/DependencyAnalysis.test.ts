import { describe, expect, test } from "bun:test"
import { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { DependenciesFinderExtractor } from "../dependencies/DependenciesFinderExtractor.js"
import { DependencyFinderPattern } from "../dependencies/DependencyFinderPattern.js"
import { DependencyUtils } from "../dependencies/DependencyUtils.js"
import { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import { ComplexOperation } from "../operations/ComplexOperation.js"
import { OperationStatement } from "../operations/OperationStatement.js"

describe("OperationStatement & ComplexOperation", () => {
  test("extract operation", () => {
    const op = new ComplexOperation([new OperationStatement("extract", ["[a-z]+"])])
    expect(op.exec("Hello123world")).toBe("ello")
  })

  test("remove operation", () => {
    const op = new ComplexOperation([new OperationStatement("remove", ["[0-9]"])])
    expect(op.exec("a1b2c3")).toBe("abc")
  })

  test("replace operation", () => {
    const op = new ComplexOperation([new OperationStatement("replace", ["\\.", "/"])])
    expect(op.exec("com.example.utils")).toBe("com/example/utils")
  })

  test("chained operations", () => {
    const op = new ComplexOperation([
      new OperationStatement("extract", ["import (.+)"]),
      new OperationStatement("replace", ["import ", ""]),
      new OperationStatement("trim", []),
    ])
    expect(op.exec("import com.example.Service ")).toBe("com.example.Service")
  })

  test("trim, uppercase, lowercase", () => {
    expect(new ComplexOperation([new OperationStatement("trim", [])]).exec("  hello  ")).toBe("hello")
    expect(new ComplexOperation([new OperationStatement("uppercase", [])]).exec("hello")).toBe("HELLO")
    expect(new ComplexOperation([new OperationStatement("lowercase", [])]).exec("HELLO")).toBe("hello")
  })

  test("append and prepend", () => {
    expect(new ComplexOperation([new OperationStatement("append", ["!"])]).exec("hi")).toBe("hi!")
    expect(new ComplexOperation([new OperationStatement("prepend", ["@"])]).exec("user")).toBe("@user")
  })
})

describe("DependencyFinderPattern — simple rules", () => {
  test("finds dependencies via content pattern matching", () => {
    const ld = new LogicalDecomposition("by-layer")
    ld.includeExternalComponents = true

    // Create components
    const serviceComp = new NamedSourceCodeAspect("service")
    serviceComp.filtering = "by-layer"
    const controllerComp = new NamedSourceCodeAspect("controller")
    controllerComp.filtering = "by-layer"

    ld.components = [serviceComp, controllerComp]

    // Create source files in "controller" component
    const file1 = new SourceFile(
      "src/controller/UserController.java",
      [
        "package com.example.controller;",
        "import com.example.service.UserService;",
        "public class UserController {",
        "}",
      ].join("\n"),
    )
    file1.linesOfCode = 4
    file1.logicalComponents = [controllerComp]

    controllerComp.sourceFiles = [file1]

    // Set up a simple rule: files in controller path that import service
    const rule = new DependencyFinderPattern()
    rule.component = "service"
    rule.pathPattern = ".*controller.*"
    rule.contentPattern = ".*import com\\.example\\.service.*"

    ld.dependenciesFinder.rules = [rule]
    ld.dependenciesFinder.useBuiltInDependencyFinders = false

    // Create the main aspect
    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file1]

    const extractor = new DependenciesFinderExtractor(ld)
    const deps = extractor.findComponentDependencies(main)

    expect(deps.length).toBe(1)
    expect(deps[0].fromComponent).toBe("controller")
    expect(deps[0].toComponent).toBe("service")
    expect(deps[0].evidence.length).toBe(1)
    expect(deps[0].evidence[0].evidence).toContain("import com.example.service")
  })

  test("reverse direction swaps from/to", () => {
    const ld = new LogicalDecomposition("modules")
    ld.includeExternalComponents = true

    const compA = new NamedSourceCodeAspect("A")
    compA.filtering = "modules"
    const compB = new NamedSourceCodeAspect("B")
    compB.filtering = "modules"
    ld.components = [compA, compB]

    const file = new SourceFile("src/A/Main.ts", "import { foo } from '../B/foo'")
    file.linesOfCode = 1
    file.logicalComponents = [compA]
    compA.sourceFiles = [file]

    const rule = new DependencyFinderPattern()
    rule.component = "B"
    rule.pathPattern = ".*A.*"
    rule.contentPattern = ".*import.*B.*"
    rule.reverseDirection = true

    ld.dependenciesFinder.rules = [rule]

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const deps = new DependenciesFinderExtractor(ld).findComponentDependencies(main)
    expect(deps.length).toBe(1)
    expect(deps[0].fromComponent).toBe("B")
    expect(deps[0].toComponent).toBe("A")
  })
})

describe("MetaDependencyRule — meta rules", () => {
  test("extracts component name via nameOperations", () => {
    const ld = new LogicalDecomposition("packages")
    ld.includeExternalComponents = true

    const utilsComp = new NamedSourceCodeAspect("utils")
    utilsComp.filtering = "packages"
    const coreComp = new NamedSourceCodeAspect("core")
    coreComp.filtering = "packages"
    ld.components = [utilsComp, coreComp]

    const file = new SourceFile("src/utils/helper.ts", "import { Config } from '@app/core/config'")
    file.linesOfCode = 1
    file.logicalComponents = [utilsComp]
    utilsComp.sourceFiles = [file]

    const metaRule = new MetaDependencyRule("", "import.*@app/([^/]+)/.*", "content")
    metaRule.nameOperations = [
      new OperationStatement("extract", ["@app/([^/]+)"]),
      new OperationStatement("replace", ["@app/", ""]),
    ]

    ld.dependenciesFinder.metaRules = [metaRule]

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const deps = new DependenciesFinderExtractor(ld).findComponentDependencies(main)
    expect(deps.length).toBe(1)
    expect(deps[0].fromComponent).toBe("utils")
    expect(deps[0].toComponent).toBe("core")
  })

  test("uses path as source when use='path'", () => {
    const ld = new LogicalDecomposition("by-dir")
    ld.includeExternalComponents = true

    const compA = new NamedSourceCodeAspect("src")
    compA.filtering = "by-dir"
    ld.components = [compA]

    const file = new SourceFile("modules/auth/login.ts", "some code")
    file.linesOfCode = 1
    file.logicalComponents = [compA]
    compA.sourceFiles = [file]

    const metaRule = new MetaDependencyRule("", "modules/([^/]+)/.*", "path")
    metaRule.nameOperations = [
      new OperationStatement("extract", ["modules/[^/]+"]),
      new OperationStatement("replace", ["modules/", ""]),
    ]

    ld.dependenciesFinder.metaRules = [metaRule]

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const deps = new DependenciesFinderExtractor(ld).findComponentDependencies(main)
    expect(deps.length).toBe(1)
    expect(deps[0].toComponent).toBe("auth")
  })
})

describe("DependencyUtils", () => {
  test("detects cyclic dependencies", () => {
    const d1 = new ComponentDependency("A", "B")
    const d2 = new ComponentDependency("B", "A")
    expect(DependencyUtils.getCyclicDependencyPlacesCount([d1, d2])).toBe(1)
  })

  test("no cycles when dependencies are one-directional", () => {
    const d1 = new ComponentDependency("A", "B")
    const d2 = new ComponentDependency("B", "C")
    expect(DependencyUtils.getCyclicDependencyPlacesCount([d1, d2])).toBe(0)
  })
})

describe("ComponentDependency", () => {
  test("getDependencyString without color", () => {
    const dep = new ComponentDependency("A", "B")
    expect(dep.getDependencyString()).toBe("A -> B")
  })

  test("getDependencyString with color", () => {
    const dep = new ComponentDependency("A", "B")
    dep.color = "red"
    expect(dep.getDependencyString()).toBe("red / A -> B")
  })
})

describe("LogicalDecomposition", () => {
  test("getComponentByName is case-insensitive", () => {
    const ld = new LogicalDecomposition("test")
    ld.components = [new NamedSourceCodeAspect("Core"), new NamedSourceCodeAspect("Utils")]
    expect(ld.getComponentByName("core")?.name).toBe("Core")
    expect(ld.getComponentByName("UTILS")?.name).toBe("Utils")
    expect(ld.getComponentByName("nonexistent")).toBeNull()
  })
})

describe("JavaAnalyzer — getMetaDependencyRules", () => {
  test("returns rules for Java import detection", () => {
    const { JavaAnalyzer } = require("../lang/JavaAnalyzer.js")
    const analyzer = new JavaAnalyzer()
    const rules = analyzer.getMetaDependencyRules()
    expect(rules.length).toBeGreaterThan(0)
    expect(rules[0].contentPattern).toBe("import .*;")
    expect(rules[0].nameOperations.length).toBeGreaterThan(0)
  })

  test("nameOperations extract package from import statement", () => {
    const { JavaAnalyzer } = require("../lang/JavaAnalyzer.js")
    const analyzer = new JavaAnalyzer()
    const rules = analyzer.getMetaDependencyRules()
    const op = new ComplexOperation(rules[0].nameOperations)

    // Standard import
    expect(op.exec("import nl.obren.sokrates.common.utils.FormattingUtils;")).toBe("nl.obren.sokrates.common.utils")

    // Wildcard import
    expect(op.exec("import nl.obren.sokrates.reports.*;")).toBe("nl.obren.sokrates.reports")

    // Static import
    expect(op.exec("import static org.junit.Assert.assertEquals;")).toBe("org.junit.Assert")
  })
})

describe("Built-in dependency detection — Java imports", () => {
  test("detects cross-component Java import dependencies", () => {
    const ld = new LogicalDecomposition("primary")
    ld.includeExternalComponents = false

    // Create components matching Sokrates structure
    const codeanalyzer = new NamedSourceCodeAspect("codeanalyzer")
    codeanalyzer.filtering = "primary"
    const common = new NamedSourceCodeAspect("common")
    common.filtering = "primary"
    const reports = new NamedSourceCodeAspect("reports")
    reports.filtering = "primary"
    ld.components = [codeanalyzer, common, reports]

    // A file in codeanalyzer that imports from common
    const file1 = new SourceFile(
      "codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/Analyzer.java",
      [
        "package nl.obren.sokrates.sourcecode;",
        "import nl.obren.sokrates.common.utils.FormattingUtils;",
        "import nl.obren.sokrates.common.io.JsonMapper;",
        "import java.util.List;",
        "public class Analyzer {}",
      ].join("\n"),
    )
    file1.extension = "java"
    file1.linesOfCode = 5
    file1.logicalComponents = [codeanalyzer]
    codeanalyzer.sourceFiles = [file1]

    // A file in reports that imports from codeanalyzer
    const file2 = new SourceFile(
      "reports/src/main/java/nl/obren/sokrates/reports/ReportGen.java",
      [
        "package nl.obren.sokrates.reports;",
        "import nl.obren.sokrates.sourcecode.SourceFile;",
        "public class ReportGen {}",
      ].join("\n"),
    )
    file2.extension = "java"
    file2.linesOfCode = 3
    file2.logicalComponents = [reports]
    reports.sourceFiles = [file2]

    ld.dependenciesFinder.useBuiltInDependencyFinders = true

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file1, file2]

    const extractor = new DependenciesFinderExtractor(ld)
    const deps = extractor.findComponentDependencies(main)

    // Should not detect java.util.List (no "java" component, includeExternalComponents=false)
    // Should detect: codeanalyzer → common (2 imports resolved via segment matching)
    // Should detect: reports → codeanalyzer (via "sourcecode" segment matching "codeanalyzer"?)
    // Actually "nl.obren.sokrates.sourcecode" has segment "sourcecode" not "codeanalyzer",
    // so reports → codeanalyzer won't match. Only codeanalyzer → common should match.
    expect(deps.length).toBe(1)
    expect(deps[0].fromComponent).toBe("codeanalyzer")
    expect(deps[0].toComponent).toBe("common")
  })

  test("detects dependencies when component names match extracted package segments", () => {
    const ld = new LogicalDecomposition("packages")
    ld.includeExternalComponents = true // allow external components

    const utils = new NamedSourceCodeAspect("com.example.utils")
    utils.filtering = "packages"
    const service = new NamedSourceCodeAspect("com.example.service")
    service.filtering = "packages"
    ld.components = [utils, service]

    const file = new SourceFile(
      "src/main/java/com/example/service/UserService.java",
      ["package com.example.service;", "import com.example.utils.StringHelper;", "public class UserService {}"].join(
        "\n",
      ),
    )
    file.extension = "java"
    file.linesOfCode = 3
    file.logicalComponents = [service]
    service.sourceFiles = [file]

    ld.dependenciesFinder.useBuiltInDependencyFinders = true

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const extractor = new DependenciesFinderExtractor(ld)
    const deps = extractor.findComponentDependencies(main)

    expect(deps.length).toBe(1)
    expect(deps[0].fromComponent).toBe("com.example.service")
    expect(deps[0].toComponent).toBe("com.example.utils")
  })

  test("does not detect self-dependencies", () => {
    const ld = new LogicalDecomposition("packages")
    ld.includeExternalComponents = true

    const service = new NamedSourceCodeAspect("com.example.service")
    service.filtering = "packages"
    ld.components = [service]

    const file = new SourceFile(
      "src/main/java/com/example/service/UserService.java",
      [
        "package com.example.service;",
        "import com.example.service.BaseService;",
        "public class UserService extends BaseService {}",
      ].join("\n"),
    )
    file.extension = "java"
    file.linesOfCode = 3
    file.logicalComponents = [service]
    service.sourceFiles = [file]

    ld.dependenciesFinder.useBuiltInDependencyFinders = true

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const deps = new DependenciesFinderExtractor(ld).findComponentDependencies(main)
    expect(deps.length).toBe(0)
  })

  test("skips built-in rules when useBuiltInDependencyFinders is false", () => {
    const ld = new LogicalDecomposition("packages")
    ld.includeExternalComponents = true

    const utils = new NamedSourceCodeAspect("com.example.utils")
    utils.filtering = "packages"
    const service = new NamedSourceCodeAspect("com.example.service")
    service.filtering = "packages"
    ld.components = [utils, service]

    const file = new SourceFile(
      "src/main/java/com/example/service/UserService.java",
      ["package com.example.service;", "import com.example.utils.StringHelper;"].join("\n"),
    )
    file.extension = "java"
    file.linesOfCode = 2
    file.logicalComponents = [service]
    service.sourceFiles = [file]

    ld.dependenciesFinder.useBuiltInDependencyFinders = false

    const main = new NamedSourceCodeAspect("main")
    main.sourceFiles = [file]

    const deps = new DependenciesFinderExtractor(ld).findComponentDependencies(main)
    expect(deps.length).toBe(0)
  })
})
