import { describe, expect, test } from "bun:test";
import { NamedSourceCodeAspect } from "../aspects/NamedSourceCodeAspect.js";
import { SourceFile } from "../aspects/SourceFile.js";
import { ComponentDependency } from "../dependencies/ComponentDependency.js";
import { DependenciesAnalysis } from "../dependencies/DependenciesAnalysis.js";
import { Dependency } from "../dependencies/Dependency.js";
import { DependencyAnchor } from "../dependencies/DependencyAnchor.js";
import { DependencyError } from "../dependencies/DependencyError.js";
import { DependencyProgressFeedback } from "../dependencies/DependencyProgressFeedback.js";
import { DependencyUtils } from "../dependencies/DependencyUtils.js";
import { SourceFileDependency } from "../dependencies/SourceFileDependency.js";

describe("SourceFileDependency", () => {
	test("wraps source file with code fragment", () => {
		const sf = new SourceFile("src/index.ts", "import { foo } from './foo'");
		const sfd = new SourceFileDependency(sf);
		sfd.codeFragment = "import { foo } from './foo'";
		expect(sfd.sourceFile.relativePath).toBe("src/index.ts");
		expect(sfd.codeFragment).toBe("import { foo } from './foo'");
	});
});

describe("DependencyAnchor", () => {
	test("has correct defaults", () => {
		const anchor = new DependencyAnchor("MyClass");
		expect(anchor.anchor).toBe("MyClass");
		expect(anchor.dependencyPatterns).toEqual([]);
		expect(anchor.sourceFiles).toEqual([]);
	});

	test("matchesLine with regex pattern", () => {
		const anchor = new DependencyAnchor("UserService");
		anchor.dependencyPatterns = [".*import.*UserService.*"];
		expect(anchor.matchesLine("import { UserService } from './services'")).toBe(
			true,
		);
		expect(anchor.matchesLine("const x = 5")).toBe(false);
	});

	test("matchesLine normalizes tabs", () => {
		const anchor = new DependencyAnchor();
		anchor.dependencyPatterns = [".*import.*Foo.*"];
		expect(anchor.matchesLine("\timport Foo")).toBe(true);
	});

	test("matchesLine truncates long lines", () => {
		const anchor = new DependencyAnchor();
		anchor.dependencyPatterns = [".*x.*"];
		const longLine = `${"a".repeat(2000)}x`;
		// The line gets truncated at MAX_REGEX_LINE_SEARCH_DEPTH (1000), so "x" is cut off
		expect(anchor.matchesLine(longLine)).toBe(false);

		const shortEnough = `${"a".repeat(500)}x`;
		expect(anchor.matchesLine(shortEnough)).toBe(true);
	});

	test("isLinkedFrom checks content for dependency", () => {
		const anchor = new DependencyAnchor("Logger");
		anchor.dependencyPatterns = [".*import.*Logger.*"];
		expect(
			anchor.isLinkedFrom("import { Logger } from './log'\nconst x = 1"),
		).toBe(true);
		expect(anchor.isLinkedFrom("const x = 1\nconst y = 2")).toBe(false);
	});

	test("getDependencyCodeFragment returns matching line", () => {
		const anchor = new DependencyAnchor("Logger");
		anchor.dependencyPatterns = [".*import.*Logger.*"];
		const result = anchor.getDependencyCodeFragment(
			"const a = 1\nimport { Logger } from './log'\nconst b = 2",
		);
		expect(result).toBe("import { Logger } from './log'");
	});

	test("getDependencyCodeFragment returns null when no match", () => {
		const anchor = new DependencyAnchor("Logger");
		anchor.dependencyPatterns = [".*import.*Logger.*"];
		expect(anchor.getDependencyCodeFragment("no imports here")).toBeNull();
	});
});

describe("Dependency", () => {
	test("getDependencyString shows from -> to", () => {
		const from = new DependencyAnchor("ModuleA");
		const to = new DependencyAnchor("ModuleB");
		const dep = new Dependency(from, to);
		expect(dep.getDependencyString()).toBe("ModuleA -> ModuleB");
	});

	test("equals compares dependency strings", () => {
		const dep1 = new Dependency(
			new DependencyAnchor("A"),
			new DependencyAnchor("B"),
		);
		const dep2 = new Dependency(
			new DependencyAnchor("A"),
			new DependencyAnchor("B"),
		);
		const dep3 = new Dependency(
			new DependencyAnchor("A"),
			new DependencyAnchor("C"),
		);
		expect(dep1.equals(dep2)).toBe(true);
		expect(dep1.equals(dep3)).toBe(false);
	});

	test("getFromComponents filters by group", () => {
		const from = new DependencyAnchor("A");
		const to = new DependencyAnchor("B");
		const dep = new Dependency(from, to);

		const sf = new SourceFile("src/a.ts");
		const aspect = new NamedSourceCodeAspect("ComponentA");
		aspect.filtering = "layer";
		sf.logicalComponents.push(aspect);

		const sfd = new SourceFileDependency(sf);
		dep.fromFiles.push(sfd);

		const components = dep.getFromComponents("layer");
		expect(components).toHaveLength(1);
		expect(components[0]!.name).toBe("ComponentA");

		// Wrong group returns empty
		expect(dep.getFromComponents("other")).toHaveLength(0);
	});

	test("getToComponents uses target anchor source files", () => {
		const to = new DependencyAnchor("B");
		const sf = new SourceFile("src/b.ts");
		const aspect = new NamedSourceCodeAspect("ComponentB");
		aspect.filtering = "layer";
		sf.logicalComponents.push(aspect);
		to.sourceFiles.push(sf);

		const dep = new Dependency(new DependencyAnchor("A"), to);
		const components = dep.getToComponents("layer");
		expect(components).toHaveLength(1);
		expect(components[0]!.name).toBe("ComponentB");
	});

	test("getComponentDependency uses component names when available", () => {
		const from = new DependencyAnchor("classA");
		const to = new DependencyAnchor("classB");

		const sfFrom = new SourceFile("src/a.ts");
		const aspectFrom = new NamedSourceCodeAspect("Frontend");
		aspectFrom.filtering = "layer";
		sfFrom.logicalComponents.push(aspectFrom);
		from.sourceFiles.push(sfFrom);

		const sfTo = new SourceFile("src/b.ts");
		const aspectTo = new NamedSourceCodeAspect("Backend");
		aspectTo.filtering = "layer";
		sfTo.logicalComponents.push(aspectTo);
		to.sourceFiles.push(sfTo);

		const dep = new Dependency(from, to);
		dep.fromFiles.push(new SourceFileDependency(sfFrom));

		expect(dep.getComponentDependency("layer")).toBe("Frontend -> Backend");
	});
});

describe("DependencyError", () => {
	test("constructs with message and filtering", () => {
		const err = new DependencyError("anchor in multiple components", "layer");
		expect(err.message).toBe("anchor in multiple components");
		expect(err.filtering).toBe("layer");
	});

	test("has empty defaults", () => {
		const err = new DependencyError();
		expect(err.message).toBe("");
		expect(err.filtering).toBe("");
	});
});

describe("DependencyProgressFeedback", () => {
	test("tracks current dependencies", () => {
		const feedback = new DependencyProgressFeedback();
		const dep = new Dependency(
			new DependencyAnchor("A"),
			new DependencyAnchor("B"),
		);
		feedback.setCurrentDependencies([dep]);
		expect(feedback.currentDependencies).toHaveLength(1);

		// Modifying original array doesn't affect stored copy
		feedback.setCurrentDependencies([]);
		expect(feedback.currentDependencies).toHaveLength(0);
	});
});

describe("DependenciesAnalysis", () => {
	test("has correct defaults", () => {
		const analysis = new DependenciesAnalysis();
		expect(analysis.dependencies).toEqual([]);
		expect(analysis.errors).toEqual([]);
		expect(analysis.metaRules).toEqual([]);
	});
});

describe("DependencyUtils", () => {
	test("addDependency creates new or appends to existing", () => {
		const deps: Dependency[] = [];
		const sourceAnchor = new DependencyAnchor("A");
		const targetAnchor = new DependencyAnchor("B");
		const sf = new SourceFile("src/a.ts");
		const sfd = new SourceFileDependency(sf);

		DependencyUtils.addDependency(deps, sfd, sourceAnchor, targetAnchor);
		expect(deps).toHaveLength(1);
		expect(deps[0]!.fromFiles).toHaveLength(1);

		// Add another file to same dependency
		const sf2 = new SourceFile("src/a2.ts");
		const sfd2 = new SourceFileDependency(sf2);
		DependencyUtils.addDependency(deps, sfd2, sourceAnchor, targetAnchor);
		expect(deps).toHaveLength(1);
		expect(deps[0]!.fromFiles).toHaveLength(2);
	});

	test("addDependency skips self-dependencies", () => {
		const deps: Dependency[] = [];
		const anchor = new DependencyAnchor("A");
		const sf = new SourceFile("src/a.ts");
		DependencyUtils.addDependency(
			deps,
			new SourceFileDependency(sf),
			anchor,
			anchor,
		);
		expect(deps).toHaveLength(0);
	});

	test("getDependenciesCount sums all counts", () => {
		const d1 = new ComponentDependency("A", "B");
		d1.count = 3;
		const d2 = new ComponentDependency("B", "C");
		d2.count = 5;
		expect(DependencyUtils.getDependenciesCount([d1, d2])).toBe(8);
	});

	test("getCyclicDependencyPlacesCount detects cycles", () => {
		const d1 = new ComponentDependency("A", "B");
		const d2 = new ComponentDependency("B", "A");
		const d3 = new ComponentDependency("A", "C");
		expect(DependencyUtils.getCyclicDependencyPlacesCount([d1, d2, d3])).toBe(
			1,
		);
	});

	test("getCyclicDependencyCount counts instances in cycles", () => {
		const d1 = new ComponentDependency("A", "B");
		d1.count = 5;
		const d2 = new ComponentDependency("B", "A");
		d2.count = 3;
		expect(DependencyUtils.getCyclicDependencyCount([d1, d2])).toBe(8);
	});

	test("findErrors detects anchors in multiple components", () => {
		const anchor = new DependencyAnchor("SharedClass");
		const sf1 = new SourceFile("src/a.ts");
		const aspect1 = new NamedSourceCodeAspect("ComponentA");
		aspect1.filtering = "layer";
		sf1.logicalComponents.push(aspect1);

		const sf2 = new SourceFile("src/b.ts");
		const aspect2 = new NamedSourceCodeAspect("ComponentB");
		aspect2.filtering = "layer";
		sf2.logicalComponents.push(aspect2);

		anchor.sourceFiles = [sf1, sf2];
		const errors: DependencyError[] = [];
		DependencyUtils.findErrors([anchor], errors);
		expect(errors).toHaveLength(1);
		expect(errors[0]!.filtering).toBe("layer");
	});

	test("findErrors no error when all same component", () => {
		const anchor = new DependencyAnchor("Util");
		const sf1 = new SourceFile("src/a.ts");
		const sf2 = new SourceFile("src/b.ts");
		const aspect = new NamedSourceCodeAspect("Shared");
		aspect.filtering = "layer";
		sf1.logicalComponents.push(aspect);
		sf2.logicalComponents.push(aspect);

		anchor.sourceFiles = [sf1, sf2];
		const errors: DependencyError[] = [];
		DependencyUtils.findErrors([anchor], errors);
		expect(errors).toHaveLength(0);
	});

	test("getComponentDependencies extracts from dependencies", () => {
		const from = new DependencyAnchor("classA");
		const to = new DependencyAnchor("classB");

		const sfFrom = new SourceFile("src/a.ts");
		sfFrom.linesOfCode = 100;
		const aspectFrom = new NamedSourceCodeAspect("Frontend");
		aspectFrom.filtering = "layer";
		sfFrom.logicalComponents.push(aspectFrom);

		const sfTo = new SourceFile("src/b.ts");
		const aspectTo = new NamedSourceCodeAspect("Backend");
		aspectTo.filtering = "layer";
		sfTo.logicalComponents.push(aspectTo);
		to.sourceFiles.push(sfTo);

		const dep = new Dependency(from, to);
		const sfd = new SourceFileDependency(sfFrom);
		sfd.codeFragment = "import classB";
		dep.fromFiles.push(sfd);

		const componentDeps = DependencyUtils.getComponentDependencies(
			[dep],
			"layer",
		);
		expect(componentDeps).toHaveLength(1);
		expect(componentDeps[0]!.fromComponent).toBe("Frontend");
		expect(componentDeps[0]!.toComponent).toBe("Backend");
		expect(componentDeps[0]!.evidence).toHaveLength(1);
	});
});
