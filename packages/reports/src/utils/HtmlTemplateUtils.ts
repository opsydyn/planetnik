import { readFileSync } from "node:fs";
import { join } from "node:path";

export class HtmlTemplateUtils {
	private static resourcesDir = "";

	static setResourcesDir(dir: string): void {
		HtmlTemplateUtils.resourcesDir = dir;
	}

	static getResource(resourcePath: string): string {
		if (!HtmlTemplateUtils.resourcesDir) return "";
		try {
			return readFileSync(
				join(HtmlTemplateUtils.resourcesDir, resourcePath),
				"utf-8",
			);
		} catch {
			return "";
		}
	}
}
