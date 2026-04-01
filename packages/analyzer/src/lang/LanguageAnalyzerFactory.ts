import { CSharpAnalyzer } from "./CSharpAnalyzer.js";
import { CStyleAnalyzer } from "./CStyleAnalyzer.js";
import { DefaultLanguageAnalyzer } from "./DefaultLanguageAnalyzer.js";
import { GoLangAnalyzer } from "./GoLangAnalyzer.js";
import { JavaAnalyzer } from "./JavaAnalyzer.js";
import { JavaScriptAnalyzer } from "./JavaScriptAnalyzer.js";
import { KotlinAnalyzer } from "./KotlinAnalyzer.js";
import type { LanguageAnalyzer } from "./LanguageAnalyzer.js";
import { PythonAnalyzer } from "./PythonAnalyzer.js";
import { RubyAnalyzer } from "./RubyAnalyzer.js";
import { RustAnalyzer } from "./RustAnalyzer.js";
import { TypeScriptAnalyzer } from "./TypeScriptAnalyzer.js";

type AnalyzerConstructor = new () => LanguageAnalyzer;

const analyzersMap = new Map<string, AnalyzerConstructor>();

// Java
for (const ext of ["java", "ck", "j", "uc"])
	analyzersMap.set(ext, JavaAnalyzer);

// JavaScript
for (const ext of ["js", "jsx", "cjs", "mjs", "es", "es6", "jsm", "njs", "sjs"])
	analyzersMap.set(ext, JavaScriptAnalyzer);

// TypeScript
for (const ext of ["ts", "tsx"]) analyzersMap.set(ext, TypeScriptAnalyzer);

// Go
for (const ext of ["go", "v"]) analyzersMap.set(ext, GoLangAnalyzer);

// C#
for (const ext of ["cs", "cake", "csx"]) analyzersMap.set(ext, CSharpAnalyzer);

// C/C++ (use CStyle base)
for (const ext of [
	"c",
	"cpp",
	"cc",
	"cxx",
	"h",
	"hpp",
	"hxx",
	"m",
	"mm",
	"dart",
])
	analyzersMap.set(ext, CStyleAnalyzer);

// Python
for (const ext of ["py", "py3", "pyw", "pyi", "pyx", "pxd"])
	analyzersMap.set(ext, PythonAnalyzer);

// Kotlin
for (const ext of ["kt", "ktm", "kts"]) analyzersMap.set(ext, KotlinAnalyzer);

// Rust
for (const ext of ["rs", "rlib"]) analyzersMap.set(ext, RustAnalyzer);

// Ruby
for (const ext of ["rb", "rake", "gemspec", "ruby"])
	analyzersMap.set(ext, RubyAnalyzer);

// Scala (C-style)
for (const ext of ["scala", "sc", "sbt"]) analyzersMap.set(ext, CStyleAnalyzer);

// Swift (C-style)
analyzersMap.set("swift", CStyleAnalyzer);

// PHP (C-style)
for (const ext of ["php", "inc", "php3", "php4", "php5"])
	analyzersMap.set(ext, CStyleAnalyzer);

// Groovy (C-style)
for (const ext of ["groovy", "grt", "gvy"])
	analyzersMap.set(ext, CStyleAnalyzer);

// Shell / SQL / HTML / CSS / XML / JSON / YAML — use default
// These have different comment styles but for now default is fine

export class LanguageAnalyzerFactory {
	private static instance = new LanguageAnalyzerFactory();

	static getInstance(): LanguageAnalyzerFactory {
		return LanguageAnalyzerFactory.instance;
	}

	getLanguageAnalyzerByExtension(extension: string): LanguageAnalyzer {
		const Ctor = analyzersMap.get(extension.toLowerCase());
		if (Ctor) return new Ctor();
		return new DefaultLanguageAnalyzer();
	}

	getLanguageAnalyzer(extension: string): LanguageAnalyzer {
		return this.getLanguageAnalyzerByExtension(extension);
	}

	getRegisteredExtensions(): string[] {
		return Array.from(analyzersMap.keys());
	}
}
