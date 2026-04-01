export class Palette {
	private index = 0;

	private constructor(readonly colors: readonly string[]) {}

	nextColor(): string {
		const color = this.colors[this.index % this.colors.length]!;
		this.index++;
		return color;
	}

	static getRiskPalette(): Palette {
		return new Palette(["#cc3333", "#e57e22", "#f1c40e", "#2ecc71"]);
	}

	static getHeatPalette(): Palette {
		return new Palette(["#3498db", "#e67e22", "#e74c3c", "#d4ac0d"]);
	}

	static getAgePalette(): Palette {
		return new Palette(["#8B4513", "#D2691E", "#DAA520", "#FFD700"]);
	}

	static getFreshnessPalette(): Palette {
		return new Palette(["#006400", "#228B22", "#32CD32", "#90EE90"]);
	}

	static getDuplicationPalette(): Palette {
		return new Palette(["#2ecc71", "#cc3333"]);
	}

	static getDefaultPalette(): Palette {
		return new Palette([
			"#3498db",
			"#e74c3c",
			"#2ecc71",
			"#e67e22",
			"#9b59b6",
			"#1abc9c",
			"#34495e",
			"#f39c12",
			"#d35400",
			"#c0392b",
			"#16a085",
			"#27ae60",
			"#2980b9",
			"#8e44ad",
			"#f1c40f",
		]);
	}
}
