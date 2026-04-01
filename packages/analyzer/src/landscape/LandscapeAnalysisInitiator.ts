import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { LandscapeConfiguration } from "./LandscapeConfiguration.js";
import { RepositoryLink } from "./RepositoryLink.js";
import { SubLandscapeLink } from "./SubLandscapeLink.js";

export class LandscapeAnalysisInitiator {
	initConfiguration(
		analysisRoot: string,
		landscapeConfigFile: string | null,
		saveFile: boolean,
	): LandscapeConfiguration {
		const config = new LandscapeConfiguration();
		config.analysisRoot = analysisRoot;

		this.walkDirectory(analysisRoot, (filePath) => {
			if (this.isLandscapeFile(filePath)) {
				this.addSubLandscape(analysisRoot, config, filePath);
			}
		});

		this.walkDirectory(analysisRoot, (filePath) => {
			if (this.isAnalysisFile(filePath)) {
				this.processAnalysisResultFile(analysisRoot, config, filePath);
			}
		});

		if (!landscapeConfigFile) {
			const landscapeDir = join(analysisRoot, "_planetnik_landscape");
			landscapeConfigFile = join(landscapeDir, "config.json");
		}

		if (!config.metadata.name) {
			const name = basename(analysisRoot);
			config.metadata = {
				...config.metadata,
				name: `${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()} Landscape`,
			};
		}

		if (saveFile) {
			this.save(landscapeConfigFile, config);
		}

		return config;
	}

	private addSubLandscape(
		root: string,
		config: LandscapeConfiguration,
		filePath: string,
	): void {
		const relativePath = relative(root, filePath);
		// _planetnik_landscape/index.html → parent is _planetnik_landscape, grandparent is the landscape dir
		const parts = relativePath.replace(/\\/g, "/").split("/");
		if (parts.length >= 2) {
			const parentName = parts[parts.length - 3] ?? parts[0];
			config.subLandscapes.push(new SubLandscapeLink(parentName, relativePath));
		}
	}

	private processAnalysisResultFile(
		root: string,
		config: LandscapeConfiguration,
		filePath: string,
	): void {
		const relativePath = relative(root, filePath);
		config.repositories.push(new RepositoryLink(relativePath));
	}

	private isAnalysisFile(filePath: string): boolean {
		return filePath.replace(/\\/g, "/").endsWith("data/analysisResults.json");
	}

	private isLandscapeFile(filePath: string): boolean {
		return filePath
			.replace(/\\/g, "/")
			.endsWith("_planetnik_landscape/index.html");
	}

	private save(configFile: string, config: LandscapeConfiguration): void {
		const dir = join(configFile, "..");
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}
		writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
	}

	private walkDirectory(
		dir: string,
		callback: (filePath: string) => void,
	): void {
		if (!existsSync(dir)) return;
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				this.walkDirectory(fullPath, callback);
			} else {
				callback(fullPath);
			}
		}
	}
}
