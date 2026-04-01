const extensionMap = new Map<string, string>([
	["java", "Java"],
	["cs", "C#"],
	["c", "C"],
	["h", "C"],
	["js", "JavaScript"],
	["cjs", "CommonJS"],
	["py", "Python"],
	["py3", "Python"],
	["pyx", "Python"],
	["sql", "SQL"],
	["php", "PHP"],
	["go", "Go"],
	["rb", "Ruby"],
	["erb", "Ruby"],
	["rs", "Rust"],
	["cpp", "C++"],
	["cxx", "C++"],
	["cc", "C++"],
	["hpp", "C++"],
	["kt", "Kotlin"],
	["kts", "Kotlin"],
	["ts", "TypeScript"],
	["tsx", "React"],
	["jsx", "React"],
	["swift", "Swift"],
	["scala", "Scala"],
	["groovy", "Groovy"],
	["gradle", "Gradle"],
	["dart", "Dart"],
	["vue", "Vue"],
	["html", "HTML"],
	["htm", "HTML"],
	["css", "CSS"],
	["scss", "Sass"],
	["less", "Less"],
	["yaml", "YAML"],
	["yml", "YAML"],
	["json", "JSON"],
	["xml", "XML"],
	["md", "Markdown"],
	["sh", "Shell"],
	["bash", "Shell"],
	["zsh", "Shell"],
	["bat", "Shell"],
	["ps1", "PowerShell"],
	["r", "R"],
	["m", "Objective-C"],
	["mm", "Objective-C"],
	["pl", "Perl"],
	["pm", "Perl"],
	["ex", "Elixir"],
	["exs", "Elixir"],
	["erl", "Erlang"],
	["hrl", "Erlang"],
	["tf", "Terraform"],
	["dockerfile", "Docker"],
	["graphql", "GraphQL"],
	["graphqls", "GraphQL"],
	["gql", "GraphQL"],
	["clj", "Clojure"],
	["thrift", "Thrift"],
	["hql", "Hive"],
	["pas", "Pascal"],
	["vb", "VisualBasic"],
	["asm", "Assembly"],
	["d", "D"],
	["cu", "CUDA"],
]);

export class DataImageUtils {
	static getLangDisplayName(lang: string): string {
		return extensionMap.get(lang.toLowerCase()) ?? lang;
	}

	static getLangDataImageDiv30(lang: string): string {
		return DataImageUtils.getLangDataImageDiv(lang, 30, 13, 11, 7, 9);
	}

	static getLangDataImageDiv42(lang: string): string {
		return DataImageUtils.getLangDataImageDiv(lang, 42, 16, 14, 12, 13);
	}

	static getLangDataImageDiv64(lang: string): string {
		return DataImageUtils.getLangDataImageDiv(lang, 60, 20, 16, 11, 13);
	}

	static getLangDataImageDiv(
		lang: string,
		size: number,
		fontSize1: number,
		fontSize2: number,
		padding1: number,
		padding2: number,
	): string {
		const nameLength = lang.length;
		const fontSize = nameLength <= 3 ? fontSize1 : fontSize2;
		const padding = nameLength <= 3 ? padding1 : padding2;
		return (
			`<div title='${lang}' style="` +
			"margin-right: 3px; display: inline-block; vertical-align: top; " +
			"padding: auto; background-color: #D6E4E1; border-radius: 50%; border: 1px solid grey; " +
			"object-fit: contain; overflow: hidden; color: darkblue; " +
			`width: ${size}px; height: ${size}px; ` +
			`font-size: ${fontSize}px; font-weight: bold; text-align: center;">` +
			`<div style="height: ${padding}px"></div>${lang}</div>`
		);
	}
}
