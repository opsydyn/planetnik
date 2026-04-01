export class BasicColorInfo {
	constructor(
		readonly red: number = 0,
		readonly green: number = 0,
		readonly blue: number = 0,
	) {}

	toHex(): string {
		const r = Math.round(this.red * 255)
			.toString(16)
			.padStart(2, "0");
		const g = Math.round(this.green * 255)
			.toString(16)
			.padStart(2, "0");
		const b = Math.round(this.blue * 255)
			.toString(16)
			.padStart(2, "0");
		return `#${r}${g}${b}`;
	}

	toRgbString(): string {
		return `${this.red} ${this.green} ${this.blue}`;
	}
}
