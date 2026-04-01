import type { FileExport } from "./FileExport.js";
import type { TagGroup } from "./TagGroup.js";

export class RepositoryTag {
	tag: string = "";
	patterns: string[] = [];
	excludePatterns: string[] = [];
	mainExtensions: string[] = [];
	anyExtensions: string[] = [];
	excludeExtensions: string[] = [];
	pathPatterns: string[] = [];
	excludePathPatterns: string[] = [];
	imageLink: string = "";
	group: TagGroup | null = null;

	excludeName(name: string): boolean {
		return this.excludePatterns.some((pattern) =>
			new RegExp(`^${pattern}$`, "i").test(name),
		);
	}

	matchesName(name: string): boolean {
		return this.patterns.some((pattern) =>
			new RegExp(`^${pattern}$`, "i").test(name),
		);
	}

	excludePath(path: string): boolean {
		return this.excludePathPatterns.some((pattern) =>
			new RegExp(`^${pattern}$`, "i").test(path),
		);
	}

	matchesPath(paths: FileExport[]): boolean {
		for (const fileExport of paths) {
			for (const pattern of this.pathPatterns) {
				if (
					new RegExp(`^${pattern}$`, "i").test(fileExport.path) &&
					!this.excludePath(fileExport.path)
				) {
					return true;
				}
			}
		}
		return false;
	}

	matchesMainTechnology(mainTech: string): boolean {
		return this.mainExtensions.some(
			(ext) => ext.toLowerCase() === mainTech.toLowerCase(),
		);
	}

	matchesAnyTechnology(
		technologies: { name: string; value: number }[],
	): boolean {
		for (const tech of technologies) {
			const techName = tech.name.replace(/.*\./, "");
			if (
				this.anyExtensions.some(
					(ext) => ext.toLowerCase() === techName.toLowerCase(),
				)
			) {
				return true;
			}
		}
		return false;
	}

	excludesMainTechnology(mainTech: string): boolean {
		return this.excludeExtensions.some(
			(ext) => ext.toLowerCase() === mainTech.toLowerCase(),
		);
	}

	getKey(): string {
		const groupName = this.group ? this.group.name : "";
		return `${groupName} / ${this.tag}`;
	}
}
