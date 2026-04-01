import { describe, expect, test } from "bun:test";
import { NamedSourceCodeAspect } from "../NamedSourceCodeAspect";
import { SourceFile } from "../SourceFile";

describe("SourceFile", () => {
	test("extracts extension from path", () => {
		const sf = new SourceFile("src/Main.java");
		expect(sf.extension).toBe("java");
	});

	test("handles no extension", () => {
		const sf = new SourceFile("Makefile");
		expect(sf.extension).toBe("");
	});

	test("splits content into lines", () => {
		const sf = new SourceFile("test.ts", "line1\nline2\nline3");
		expect(sf.lines.length).toBe(3);
	});

	test("setLinesOfCodeFromCleanedLines uses cleaned lines length", () => {
		const sf = new SourceFile("test.ts", "line1\n\nline3");
		sf.cleanedLines = ["line1", "line3"];
		sf.setLinesOfCodeFromCleanedLines();
		expect(sf.linesOfCode).toBe(2);
	});

	test("getLongLinesCount counts lines exceeding threshold", () => {
		const sf = new SourceFile("test.ts", "short\nthis is a longer line\nx");
		expect(sf.getLongLinesCount(10)).toBe(1);
	});

	test("isInLogicalComponent checks component membership", () => {
		const sf = new SourceFile("test.ts");
		const comp = NamedSourceCodeAspect.make({ name: "frontend" });
		sf.logicalComponents.push(comp);
		expect(sf.isInLogicalComponent("frontend")).toBe(true);
		expect(sf.isInLogicalComponent("backend")).toBe(false);
	});
});

describe("NamedSourceCodeAspect", () => {
	test("getLinesOfCode sums source files", () => {
		const aspect = NamedSourceCodeAspect.make({ name: "main" });
		const f1 = new SourceFile("a.ts");
		f1.linesOfCode = 100;
		const f2 = new SourceFile("b.ts");
		f2.linesOfCode = 200;
		aspect.sourceFiles = [f1, f2];
		expect(aspect.getLinesOfCode()).toBe(300);
	});

	test("remove excludes files from other aspect", () => {
		const main = NamedSourceCodeAspect.make({ name: "main" });
		const test = NamedSourceCodeAspect.make({ name: "test" });
		const f1 = new SourceFile("src/Main.ts");
		const f2 = new SourceFile("test/Main.test.ts");
		main.sourceFiles = [f1, f2];
		test.sourceFiles = [f2];
		main.remove(test);
		expect(main.sourceFiles.length).toBe(1);
		expect(main.sourceFiles[0]!.relativePath).toBe("src/Main.ts");
	});

	test("getFileSystemFriendlyName produces safe name", () => {
		const aspect = NamedSourceCodeAspect.make({ name: "build and deployment" });
		expect(aspect.getFileSystemFriendlyName("scope_")).toBe(
			"scope_build_and_deployment",
		);
	});
});
