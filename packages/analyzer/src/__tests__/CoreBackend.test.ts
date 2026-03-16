import { describe, expect, test } from "bun:test"
import { GroupingRule } from "../aspects/GroupingRule.js"
import { MetaRulesProcessor } from "../aspects/MetaRulesProcessor.js"
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js"
import { SourceFile } from "../aspects/SourceFile.js"
import { StandardSecurityAspects } from "../catalogs/StandardSecurityAspects.js"
import { CodeBlockParser } from "../cleaners/CodeBlockParser.js"
import { CommentsCleanerUtils } from "../cleaners/CommentsCleanerUtils.js"
import { ContributionTimeSlot } from "../contributors/ContributionTimeSlot.js"
import { Contributor } from "../contributors/Contributor.js"
import { ContributorsImport } from "../contributors/ContributorsImport.js"
import { GitContributorsUtil } from "../contributors/GitContributorsUtil.js"
import { CodeConfigurationUtils } from "../core/CodeConfigurationUtils.js"
import { ReferenceAnalysisResult } from "../core/ReferenceAnalysisResult.js"
import { MetaRule } from "../dependencies/MetaRule.js"
import { DuplicatedFileBlock } from "../duplication/DuplicatedFileBlock.js"
import { DuplicationDependenciesHelper } from "../duplication/DuplicationDependenciesHelper.js"
import { DuplicationInstance } from "../duplication/DuplicationInstance.js"
import { ComponentUpdateHistory } from "../filehistory/ComponentUpdateHistory.js"
import { FileHistoryComponentsHelper } from "../filehistory/FileHistoryComponentsHelper.js"
import { FileModificationHistory } from "../filehistory/FileModificationHistory.js"
import { AuthorCommit } from "../githistory/GitHistoryUtils.js"
import { ComplexOperation } from "../operations/ComplexOperation.js"
import { OperationStatement } from "../operations/OperationStatement.js"
import { ConcernConventions } from "../scoping/ConcernConventions.js"
import { CustomConventionsHelper } from "../scoping/CustomConventionsHelper.js"
import { CustomExtensionConventions } from "../scoping/CustomExtensionConventions.js"
import { CustomScopingConventions } from "../scoping/CustomScopingConventions.js"

// ── ComplexOperation multi-param fixes ──────────────────────────────────

describe("ComplexOperation — multi-param behavior", () => {
  test("append appends ALL params", () => {
    const op = new ComplexOperation([new OperationStatement("append", ["!", "?", "."])])
    expect(op.exec("hi")).toBe("hi!?.")
  })

  test("prepend prepends ALL params concatenated", () => {
    const op = new ComplexOperation([new OperationStatement("prepend", ["@", "#"])])
    expect(op.exec("user")).toBe("@#user")
  })

  test("remove removes ALL param patterns", () => {
    const op = new ComplexOperation([new OperationStatement("remove", ["[0-9]", "[A-Z]"])])
    expect(op.exec("a1B2c3D4")).toBe("ac")
  })

  test("replace iterates params in pairs", () => {
    const op = new ComplexOperation([new OperationStatement("replace", ["\\.", "/", "-", "_"])])
    expect(op.exec("com.example-utils")).toBe("com/example_utils")
  })

  test("replace .* special case replaces entire input", () => {
    const op = new ComplexOperation([new OperationStatement("replace", [".*", "replaced"])])
    expect(op.exec("anything")).toBe("replaced")
  })

  test("extract uses RegexUtils.getMatchedRegex", () => {
    const op = new ComplexOperation([new OperationStatement("extract", ["[a-z]+"])])
    expect(op.exec("Hello123world")).toBe("ello")
  })

  test("extract with multiple params chains extractions", () => {
    const op = new ComplexOperation([new OperationStatement("extract", ["[a-z]+\\.[a-z]+", "[a-z]+$"])])
    expect(op.exec("import com.example")).toBe("example")
  })

  test("extract returns empty string when no match", () => {
    const op = new ComplexOperation([new OperationStatement("extract", ["[0-9]+"])])
    expect(op.exec("no digits")).toBe("")
  })

  test("unknown operation returns input unchanged", () => {
    const op = new ComplexOperation([new OperationStatement("noop", [])])
    expect(op.exec("hello")).toBe("hello")
  })
})

// ── MetaRulesProcessor ──────────────────────────────────────────────────

describe("MetaRulesProcessor", () => {
  test("getConcernsInstance extracts concerns from content", () => {
    const processor = MetaRulesProcessor.getConcernsInstance()
    const file1 = new SourceFile("src/app.ts", "import foo.bar\nimport foo.baz\n")
    const file2 = new SourceFile("src/util.ts", "import qux.quux\n")

    const rule = new MetaRule(".*\\.ts", "import .*", "content")
    rule.nameOperations = [
      new OperationStatement("extract", ["import (.+)"]),
      new OperationStatement("replace", ["import ", ""]),
    ]

    const concerns = processor.extractAspects([file1, file2], [rule])
    const names = concerns.map((c) => c.name).sort()
    expect(names).toContain("foo.bar")
    expect(names).toContain("foo.baz")
    expect(names).toContain("qux.quux")
    expect(concerns.length).toBe(3)
  })

  test("getLogicalDecompositionInstance uses unique classification", () => {
    const processor = MetaRulesProcessor.getLogicalDecompositionInstance()
    const file = new SourceFile("src/components/Button.ts", "module Button\nmodule Icon\n")

    const rule = new MetaRule(".*", "module .*", "content")
    rule.nameOperations = [new OperationStatement("replace", ["module ", ""])]

    const aspects = processor.extractAspects([file], [rule])
    // uniqueClassification: file only gets first match
    expect(aspects.length).toBe(1)
    expect(aspects[0]!.name).toBe("Button")
  })

  test("path-based extraction", () => {
    const processor = MetaRulesProcessor.getConcernsInstance()
    const file1 = new SourceFile("src/auth/login.ts")
    const file2 = new SourceFile("src/data/repo.ts")

    const rule = new MetaRule(".*", "src/([^/]+)/.*", "path")
    rule.nameOperations = [
      new OperationStatement("extract", ["src/([^/]+)/"]),
      new OperationStatement("replace", ["src/", "", "/", ""]),
    ]

    const concerns = processor.extractAspects([file1, file2], [rule])
    expect(concerns.length).toBe(2)
  })
})

// ── GroupingRule ─────────────────────────────────────────────────────────

describe("GroupingRule", () => {
  test("has name and pattern properties", () => {
    const rule = new GroupingRule()
    rule.name = "Core"
    rule.pattern = ".*core.*"
    expect(rule.name).toBe("Core")
    expect(rule.pattern).toBe(".*core.*")
  })
})

// ── DuplicationDependenciesHelper ───────────────────────────────────────

describe("DuplicationDependenciesHelper", () => {
  test("extracts dependencies from duplication instances", () => {
    const compA = new NamedSourceCodeAspect("CompA")
    const compB = new NamedSourceCodeAspect("CompB")

    const file1 = new SourceFile("src/a.ts")
    file1.logicalComponents = [compA]
    const file2 = new SourceFile("src/b.ts")
    file2.logicalComponents = [compB]

    const block1 = new DuplicatedFileBlock()
    block1.sourceFile = file1
    block1.cleanedStartLine = 0
    block1.cleanedEndLine = 5

    const block2 = new DuplicatedFileBlock()
    block2.sourceFile = file2
    block2.cleanedStartLine = 10
    block2.cleanedEndLine = 15

    const instance = new DuplicationInstance()
    instance.duplicatedFileBlocks = [block1, block2]

    const helper = new DuplicationDependenciesHelper("")
    const deps = helper.extractDependencies([instance])

    expect(deps.length).toBe(1)
    expect(deps[0]!.fromComponent).toBe("CompA")
    expect(deps[0]!.toComponent).toBe("CompB")
    expect(deps[0]!.count).toBeGreaterThan(0)
  })

  test("skips same-component duplication", () => {
    const comp = new NamedSourceCodeAspect("Same")
    const file1 = new SourceFile("src/a.ts")
    file1.logicalComponents = [comp]
    const file2 = new SourceFile("src/b.ts")
    file2.logicalComponents = [comp]

    const block1 = new DuplicatedFileBlock()
    block1.sourceFile = file1
    block1.cleanedStartLine = 0
    block1.cleanedEndLine = 3

    const block2 = new DuplicatedFileBlock()
    block2.sourceFile = file2
    block2.cleanedStartLine = 0
    block2.cleanedEndLine = 3

    const instance = new DuplicationInstance()
    instance.duplicatedFileBlocks = [block1, block2]

    const helper = new DuplicationDependenciesHelper("")
    const deps = helper.extractDependencies([instance])
    expect(deps.length).toBe(0)
  })
})

// ── ConcernConventions ──────────────────────────────────────────────────

describe("ConcernConventions", () => {
  test("has default conventions", () => {
    const cc = new ConcernConventions()
    expect(cc.exceptionHandling.length).toBe(2)
    expect(cc.todos.length).toBe(1)
    expect(cc.logging.length).toBe(2)
    expect(cc.printingToConsole.length).toBe(1)
  })

  test("empty categories default to empty arrays", () => {
    const cc = new ConcernConventions()
    expect(cc.authentication.length).toBe(0)
    expect(cc.encryption.length).toBe(0)
    expect(cc.databaseAccess.length).toBe(0)
  })
})

// ── CustomScopingConventions ────────────────────────────────────────────

describe("CustomScopingConventions", () => {
  test("has defaults", () => {
    const c = new CustomScopingConventions()
    expect(c.ignoreStandardScopingConventions).toBe(false)
    expect(c.removeStandardConcerns).toBe(false)
    expect(c.componentsFolderDepth).toBe(1)
    expect(c.concerns.length).toBe(0)
    expect(c.extensions.onlyInclude.length).toBe(0)
  })
})

describe("CustomExtensionConventions", () => {
  test("has empty lists by default", () => {
    const c = new CustomExtensionConventions()
    expect(c.onlyInclude).toEqual([])
    expect(c.alwaysExclude).toEqual([])
  })
})

describe("CustomConventionsHelper", () => {
  test("exportStandardConventions returns populated conventions", () => {
    const c = CustomConventionsHelper.exportStandardConventions()
    expect(c.testFilesConventions.length).toBeGreaterThan(0)
    expect(c.generatedFilesConventions.length).toBeGreaterThan(0)
    expect(c.buildAndDeploymentFilesConventions.length).toBeGreaterThan(0)
  })
})

// ── CodeConfigurationUtils ──────────────────────────────────────────────

describe("CodeConfigurationUtils", () => {
  test("getDefaultSokratesFolder", () => {
    expect(CodeConfigurationUtils.getDefaultSokratesFolder("/project")).toBe("/project/_sokrates")
  })

  test("getDefaultSokratesConfigFile", () => {
    expect(CodeConfigurationUtils.getDefaultSokratesConfigFile("/project")).toBe("/project/_sokrates/config.json")
  })

  test("getDefaultSokratesReportsFolder", () => {
    expect(CodeConfigurationUtils.getDefaultSokratesReportsFolder("/project")).toBe("/project/_sokrates/reports")
  })

  test("populateUnclassifiedAndMultipleAspectsFiles", () => {
    const aspect1 = new NamedSourceCodeAspect("Module1")
    const file1 = new SourceFile("src/a.ts")
    const file2 = new SourceFile("src/b.ts")
    const file3 = new SourceFile("src/c.ts")
    aspect1.sourceFiles = [file1, file3]

    const aspect2 = new NamedSourceCodeAspect("Module2")
    aspect2.sourceFiles = [file3]

    const aspects: NamedSourceCodeAspect[] = [aspect1, aspect2]

    CodeConfigurationUtils.populateUnclassifiedAndMultipleAspectsFiles(aspects, [file1, file2, file3], () => {})

    const names = aspects.map((a) => a.name)
    expect(names).toContain("Unclassified")
    expect(names).toContain("Multiple Classifications")
  })

  test("removeEmptyAspects", () => {
    const a1 = new NamedSourceCodeAspect("Empty")
    const a2 = new NamedSourceCodeAspect("HasFiles")
    a2.sourceFiles = [new SourceFile("test.ts")]
    const aspects = [a1, a2]
    CodeConfigurationUtils.removeEmptyAspects(aspects)
    expect(aspects.length).toBe(1)
    expect(aspects[0]!.name).toBe("HasFiles")
  })
})

// ── ReferenceAnalysisResult ─────────────────────────────────────────────

describe("ReferenceAnalysisResult", () => {
  test("has defaults", () => {
    const r = new ReferenceAnalysisResult()
    expect(r.label).toBe("DATE")
    expect(r.analysisResultsPath).toBe("")
  })

  test("accepts constructor args", () => {
    const r = new ReferenceAnalysisResult("v1.0", "/path/to/results.zip")
    expect(r.label).toBe("v1.0")
    expect(r.analysisResultsPath).toBe("/path/to/results.zip")
  })
})

// ── CodeBlockParser ─────────────────────────────────────────────────────

describe("CodeBlockParser", () => {
  test("getStringStartIndex finds start marker", () => {
    const parser = new CodeBlockParser()
    expect(parser.getStringStartIndex('hello "world"', 0)).toBe(6)
  })

  test("getStringEndIndex handles escape markers", () => {
    const parser = new CodeBlockParser('"', '"', "\\", true)
    // In: "hello" — fromIndex=1 (after opening quote), find closing quote at 6
    expect(parser.getStringEndIndex('"hello"', 1)).toBe(6)
    // escaped quote: "say \"hi\"" — from 1, the escaped quotes get skipped
    const escaped = '"say \\"hi\\""'
    expect(parser.getStringEndIndex(escaped, 1)).toBe(escaped.length - 1)
  })

  test("cleanOrSkip removes content", () => {
    const parser = new CodeBlockParser()
    const result = parser.cleanOrSkip('code "string" more', 5)
    expect(result.content).toBe("code  more")
  })

  test("cleanOrSkip preserves newlines", () => {
    const parser = new CodeBlockParser()
    const result = parser.cleanOrSkip('code "line1\nline2" more', 5)
    expect(result.content).toContain("\n")
    expect(result.content).not.toContain("line1")
  })

  test("cleanOrSkip handles unclosed string", () => {
    const parser = new CodeBlockParser()
    const result = parser.cleanOrSkip('code "unclosed', 5)
    expect(result.content).toBe("code ")
  })
})

// ── CommentsCleanerUtils ────────────────────────────────────────────────

describe("CommentsCleanerUtils", () => {
  test("cleanLineComments removes line comments", () => {
    const result = CommentsCleanerUtils.cleanLineComments("code // comment\nmore code", "//")
    expect(result).not.toContain("comment")
    expect(result).toContain("code ")
    expect(result).toContain("more code")
  })

  test("cleanBlockComments removes block comments", () => {
    const result = CommentsCleanerUtils.cleanBlockComments("code /* comment */ more", "/*", "*/")
    expect(result).not.toContain("comment")
    expect(result).toContain("code ")
    expect(result).toContain(" more")
  })

  test("cleanBlockComments preserves newlines", () => {
    const result = CommentsCleanerUtils.cleanBlockComments("code /* line1\nline2 */ more", "/*", "*/")
    expect(result).toContain("\n")
    expect(result).not.toContain("line1")
  })
})

// ── Contributor (enhanced) ──────────────────────────────────────────────

describe("Contributor — addCommit", () => {
  test("addCommit tracks dates and counts", () => {
    const c = new Contributor("alice@test.com")
    c.addCommit("2020-01-15", 3)
    c.addCommit("2020-06-20", 5)

    expect(c.commitsCount).toBe(2)
    expect(c.firstCommitDate).toBe("2020-01-15")
    expect(c.latestCommitDate).toBe("2020-06-20")
    expect(c.activeYears).toEqual(["2020"])
    expect(c.commitDates.length).toBe(2)
  })

  test("addCommit deduplicates dates", () => {
    const c = new Contributor("alice@test.com")
    c.addCommit("2020-01-15", 1)
    c.addCommit("2020-01-15", 1)
    expect(c.commitsCount).toBe(2)
    expect(c.commitDates.length).toBe(1)
  })
})

// ── ContributionTimeSlot ────────────────────────────────────────────────

describe("ContributionTimeSlot", () => {
  test("increment methods", () => {
    const slot = new ContributionTimeSlot("2024-01")
    slot.incrementCommitsCount()
    slot.incrementCommitsCount()
    slot.incrementFileUpdatesCount(5)
    expect(slot.commitsCount).toBe(2)
    expect(slot.fileUpdatesCount).toBe(5)
    expect(slot.timeSlot).toBe("2024-01")
  })
})

// ── ContributorsImport ──────────────────────────────────────────────────

describe("ContributorsImport", () => {
  test("has empty defaults", () => {
    const ci = new ContributorsImport()
    expect(ci.contributors.length).toBe(0)
    expect(ci.contributorsPerYear.length).toBe(0)
    expect(ci.firstCommitDate).toBe("")
  })
})

// ── GitContributorsUtil ─────────────────────────────────────────────────

describe("GitContributorsUtil", () => {
  test("getContributors aggregates by email", () => {
    const commit1 = new AuthorCommit()
    commit1.authorEmail = "alice@test.com"
    commit1.date = "2024-01-15"
    commit1.fileUpdatesCount = 3

    const commit2 = new AuthorCommit()
    commit2.authorEmail = "alice@test.com"
    commit2.date = "2024-01-20"
    commit2.fileUpdatesCount = 2

    const commit3 = new AuthorCommit()
    commit3.authorEmail = "bob@test.com"
    commit3.date = "2024-01-18"
    commit3.fileUpdatesCount = 1

    const contributors = GitContributorsUtil.getContributors([commit1, commit2, commit3])
    expect(contributors.length).toBe(2)
    expect(contributors[0]!.email).toBe("alice@test.com")
    expect(contributors[0]!.commitsCount).toBe(2)
    expect(contributors[1]!.email).toBe("bob@test.com")
  })

  test("getContributorsPerTimeSlot groups by year", () => {
    const commit1 = new AuthorCommit()
    commit1.authorEmail = "alice@test.com"
    commit1.date = "2024-01-15"

    const commit2 = new AuthorCommit()
    commit2.authorEmail = "bob@test.com"
    commit2.date = "2024-01-20"

    const slots = GitContributorsUtil.getContributorsPerTimeSlot([commit1, commit2], (c) => c.getYear())
    expect(slots.length).toBe(1)
    expect(slots[0]!.timeSlot).toBe("2024")
    expect(slots[0]!.contributorsCount).toBe(2)
    expect(slots[0]!.commitsCount).toBe(2)
  })

  test("importFromAuthorCommits builds full import", () => {
    const commit = new AuthorCommit()
    commit.authorEmail = "alice@test.com"
    commit.date = "2024-03-10"
    commit.fileUpdatesCount = 5

    const result = GitContributorsUtil.importFromAuthorCommits([commit])
    expect(result.contributors.length).toBe(1)
    expect(result.firstCommitDate).toBe("2024-03-10")
    expect(result.latestCommitDate).toBe("2024-03-10")
    expect(result.contributorsPerYear.length).toBe(1)
  })
})

// ── ComponentUpdateHistory ──────────────────────────────────────────────

describe("ComponentUpdateHistory", () => {
  test("addDate tracks unique sorted dates", () => {
    const comp = new NamedSourceCodeAspect("CompA")
    const history = new ComponentUpdateHistory(comp)
    history.addDate("2024-03-01")
    history.addDate("2024-01-15")
    history.addDate("2024-03-01") // duplicate
    expect(history.dates).toEqual(["2024-01-15", "2024-03-01"])
  })
})

// ── FileHistoryComponentsHelper ─────────────────────────────────────────

describe("FileHistoryComponentsHelper", () => {
  test("getUniqueDates extracts and sorts unique dates", () => {
    const h1 = new FileModificationHistory("a.ts")
    h1.dates = ["2024-01-15T10:00:00", "2024-01-15T15:00:00"]
    const h2 = new FileModificationHistory("b.ts")
    h2.dates = ["2024-03-01T10:00:00"]

    const helper = new FileHistoryComponentsHelper()
    const dates = helper.getUniqueDates([h1, h2])
    expect(dates).toEqual(["2024-01-15", "2024-03-01"])
  })

  test("getNumberOfActiveDays returns count", () => {
    const h = new FileModificationHistory("a.ts")
    h.dates = ["2024-01-01", "2024-01-02", "2024-01-01"]
    const helper = new FileHistoryComponentsHelper()
    expect(helper.getNumberOfActiveDays([h])).toBe(2)
  })
})

// ── StandardSecurityAspects ─────────────────────────────────────────────

describe("StandardSecurityAspects", () => {
  test("creates security concerns group", () => {
    const sec = new StandardSecurityAspects()
    expect(sec.name).toBe("security")
    expect(sec.concerns.length).toBe(9)
    expect(sec.concerns.map((c) => c.name)).toContain("authentication")
    expect(sec.concerns.map((c) => c.name)).toContain("cryptography")
  })
})
