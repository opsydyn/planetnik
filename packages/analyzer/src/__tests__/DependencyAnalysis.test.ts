import { describe, expect, test } from "bun:test"
import { LogicalDecompositionAnalyzer } from "../analysis/LogicalDecompositionAnalyzer.js"
import { LogicalDecomposition } from "../aspects/LogicalDecomposition.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { CodeConfiguration } from "../core/CodeConfiguration.js"
import { SourceFileFilter } from "../core/SourceFileFilter.js"
import { ComponentDependency } from "../dependencies/ComponentDependency.js"
import { DependenciesFinderExtractor } from "../dependencies/DependenciesFinderExtractor.js"
import { Dependency } from "../dependencies/Dependency.js"
import { DependencyAnchor } from "../dependencies/DependencyAnchor.js"
import { DependencyFinderPattern } from "../dependencies/DependencyFinderPattern.js"
import { DependencyUtils } from "../dependencies/DependencyUtils.js"
import { MetaDependencyRule } from "../dependencies/MetaDependencyRule.js"
import { SourceFileDependency } from "../dependencies/SourceFileDependency.js"
import { ComplexOperation } from "../operations/ComplexOperation.js"
import { OperationStatement } from "../operations/OperationStatement.js"
import { CodeAnalysisResults } from "../results/CodeAnalysisResults.js"

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
    expect(deps[0]!.fromComponent).toBe("controller")
    expect(deps[0]!.toComponent).toBe("service")
    expect(deps[0]!.evidence.length).toBe(1)
    expect(deps[0]!.evidence[0]!.evidence).toContain("import com.example.service")
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
    expect(deps[0]!.fromComponent).toBe("B")
    expect(deps[0]!.toComponent).toBe("A")
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
    expect(deps[0]!.fromComponent).toBe("utils")
    expect(deps[0]!.toComponent).toBe("core")
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
    expect(deps[0]!.toComponent).toBe("auth")
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
  test("does not rely on built-in meta dependency rules", () => {
    const { JavaAnalyzer } = require("../lang/JavaAnalyzer.js")
    const analyzer = new JavaAnalyzer()
    const rules = analyzer.getMetaDependencyRules()
    expect(rules).toEqual([])
  })

  test("extractDependencies resolves Java package anchors to logical components", () => {
    const { JavaAnalyzer } = require("../lang/JavaAnalyzer.js")
    const analyzer = new JavaAnalyzer()

    const cliFile = new SourceFile(
      "cli/src/main/java/nl/obren/sokrates/cli/SokratesFileUtils.java",
      [
        "package nl.obren.sokrates.cli;",
        "import nl.obren.sokrates.sourcecode.githistory.GitHistoryUtils;",
        "public class SokratesFileUtils {}",
      ].join("\n"),
    )
    cliFile.linesOfCode = 3
    const cliComponent = new NamedSourceCodeAspect("cli")
    cliComponent.filtering = "primary"
    cliFile.logicalComponents.push(cliComponent)

    const codeAnalyzerFile = new SourceFile(
      "codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/githistory/GitHistoryUtils.java",
      ["package nl.obren.sokrates.sourcecode.githistory;", "public class GitHistoryUtils {}"].join("\n"),
    )
    codeAnalyzerFile.linesOfCode = 2
    const codeAnalyzerComponent = new NamedSourceCodeAspect("codeanalyzer")
    codeAnalyzerComponent.filtering = "primary"
    codeAnalyzerFile.logicalComponents.push(codeAnalyzerComponent)

    const analysis = analyzer.extractDependencies([cliFile, codeAnalyzerFile])
    expect(analysis.dependencies).toHaveLength(1)

    const componentDependencies = DependencyUtils.getComponentDependencies(analysis.dependencies, "primary")
    expect(componentDependencies).toHaveLength(1)
    expect(componentDependencies[0]!.fromComponent).toBe("cli")
    expect(componentDependencies[0]!.toComponent).toBe("codeanalyzer")
    expect(componentDependencies[0]!.count).toBe(1)
  })

  test("getComponentDependencies maps package anchors to owning components", () => {
    const cliFile = new SourceFile("cli/src/main/java/nl/obren/sokrates/cli/App.java")
    cliFile.linesOfCode = 20
    const cliComponent = new NamedSourceCodeAspect("cli")
    cliComponent.filtering = "primary"
    cliFile.logicalComponents.push(cliComponent)

    const codeAnalyzerFile = new SourceFile("codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/core/Model.java")
    const codeAnalyzerComponent = new NamedSourceCodeAspect("codeanalyzer")
    codeAnalyzerComponent.filtering = "primary"
    codeAnalyzerFile.logicalComponents.push(codeAnalyzerComponent)

    const dependency = new Dependency(
      new DependencyAnchor("nl.obren.sokrates.cli"),
      new DependencyAnchor("nl.obren.sokrates.sourcecode.core"),
    )
    dependency.to.sourceFiles.push(codeAnalyzerFile)

    const sourceFileDependency = new SourceFileDependency(cliFile)
    sourceFileDependency.codeFragment = "import nl.obren.sokrates.sourcecode.core.Model;"
    dependency.fromFiles.push(sourceFileDependency)

    const componentDependencies = DependencyUtils.getComponentDependencies([dependency], "primary")
    expect(componentDependencies).toHaveLength(1)
    expect(componentDependencies[0]!.fromComponent).toBe("cli")
    expect(componentDependencies[0]!.toComponent).toBe("codeanalyzer")
  })
})

describe("Built-in dependency detection — Java imports", () => {
  test("maps built-in Java package anchors back to logical components through the analyzer", () => {
    const results = new CodeAnalysisResults()
    const config = new CodeConfiguration()

    const common = new NamedSourceCodeAspect("common")
    common.filtering = "primary"
    common.sourceFileFilters = [SourceFileFilter.make({ pathPattern: "common/.*" })]

    const codeanalyzer = new NamedSourceCodeAspect("codeanalyzer")
    codeanalyzer.filtering = "primary"
    codeanalyzer.sourceFileFilters = [SourceFileFilter.make({ pathPattern: "codeanalyzer/.*" })]

    const reports = new NamedSourceCodeAspect("reports")
    reports.filtering = "primary"
    reports.sourceFileFilters = [SourceFileFilter.make({ pathPattern: "reports/.*" })]

    const decomposition = new LogicalDecomposition("primary")
    decomposition.includeExternalComponents = false
    decomposition.components = [common, codeanalyzer, reports]
    decomposition.dependenciesFinder.useBuiltInDependencyFinders = true

    const formattingUtils = new SourceFile(
      "common/src/main/java/nl/obren/sokrates/common/utils/FormattingUtils.java",
      ["package nl.obren.sokrates.common.utils;", "public class FormattingUtils {}"].join("\n"),
    )
    formattingUtils.extension = "java"
    formattingUtils.linesOfCode = 2

    const sourceFileModel = new SourceFile(
      "codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/SourceFile.java",
      ["package nl.obren.sokrates.sourcecode;", "public class SourceFile {}"].join("\n"),
    )
    sourceFileModel.extension = "java"
    sourceFileModel.linesOfCode = 2

    const analyzer = new SourceFile(
      "codeanalyzer/src/main/java/nl/obren/sokrates/sourcecode/Analyzer.java",
      [
        "package nl.obren.sokrates.sourcecode;",
        "import nl.obren.sokrates.common.utils.FormattingUtils;",
        "public class Analyzer {}",
      ].join("\n"),
    )
    analyzer.extension = "java"
    analyzer.linesOfCode = 3

    const reportGen = new SourceFile(
      "reports/src/main/java/nl/obren/sokrates/reports/ReportGen.java",
      [
        "package nl.obren.sokrates.reports;",
        "import nl.obren.sokrates.sourcecode.SourceFile;",
        "public class ReportGen {}",
      ].join("\n"),
    )
    reportGen.extension = "java"
    reportGen.linesOfCode = 3

    config.main.sourceFiles = [formattingUtils, sourceFileModel, analyzer, reportGen]
    config.logicalDecompositions = [decomposition]
    results.codeConfiguration = config

    new LogicalDecompositionAnalyzer(results).analyze()

    const dependencies = results.logicalDecompositionsAnalysisResults[0]?.componentDependencies ?? []
    expect(dependencies).toHaveLength(2)
    expect(dependencies.map((dependency) => `${dependency.fromComponent}->${dependency.toComponent}`)).toEqual([
      "codeanalyzer->common",
      "reports->codeanalyzer",
    ])
  })

  test("does not emit self-dependencies after built-in Java extraction is mapped to components", () => {
    const { JavaAnalyzer } = require("../lang/JavaAnalyzer.js")
    const analyzer = new JavaAnalyzer()

    const serviceComponent = new NamedSourceCodeAspect("service")
    serviceComponent.filtering = "packages"

    const baseService = new SourceFile(
      "src/main/java/com/example/service/BaseService.java",
      ["package com.example.service;", "public class BaseService {}"].join("\n"),
    )
    baseService.linesOfCode = 2
    baseService.logicalComponents.push(serviceComponent)

    const userService = new SourceFile(
      "src/main/java/com/example/service/UserService.java",
      [
        "package com.example.service;",
        "import com.example.service.BaseService;",
        "public class UserService extends BaseService {}",
      ].join("\n"),
    )
    userService.linesOfCode = 3
    userService.logicalComponents.push(serviceComponent)

    const analysis = analyzer.extractDependencies([baseService, userService])
    const componentDependencies = DependencyUtils.getComponentDependencies(analysis.dependencies, "packages")

    expect(componentDependencies).toHaveLength(0)
  })
})
