import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MetadataType } from "../core/Metadata.js";
import { LandscapeAnalysisInitiator } from "./LandscapeAnalysisInitiator.js";
import { LandscapeConfiguration } from "./LandscapeConfiguration.js";
import { LandscapeInfo } from "./LandscapeInfo.js";

export class LandscapeAnalysisUpdater {
	updateConfiguration(
		analysisRoot: string,
		landscapeConfigFile: string | null,
		metadata: MetadataType | null,
	): LandscapeConfiguration {
		landscapeConfigFile = this.getLandscapeConfigFile(
			analysisRoot,
			landscapeConfigFile,
		);
		const landscapeInfoFile = this.getLandscapeInfoFile(analysisRoot);
		const newConfig = this.getNewConfig(analysisRoot, landscapeConfigFile);

		if (existsSync(landscapeConfigFile)) {
			try {
				const json = readFileSync(landscapeConfigFile, "utf-8");
				const existingConfig: LandscapeConfiguration = Object.assign(
					new LandscapeConfiguration(),
					JSON.parse(json),
				);
				existingConfig.subLandscapes = newConfig.subLandscapes;
				existingConfig.repositories = newConfig.repositories;
				this.updateMetadata(existingConfig, metadata);
				this.save(landscapeConfigFile, landscapeInfoFile, existingConfig);
				return existingConfig;
			} catch {
				// Fall through to create new config
			}
		}

		this.updateMetadata(newConfig, metadata);
		this.save(landscapeConfigFile, landscapeInfoFile, newConfig);
		return newConfig;
	}

	private updateMetadata(
		config: LandscapeConfiguration,
		metadata: MetadataType | null,
	): void {
		if (!metadata) return;
		config.metadata = {
			...config.metadata,
			name: metadata.name || config.metadata.name,
			description: metadata.description || config.metadata.description,
			logoLink: metadata.logoLink || config.metadata.logoLink,
			links: metadata.links.length > 0 ? metadata.links : config.metadata.links,
		};
	}

	private getLandscapeConfigFile(
		analysisRoot: string,
		configFile: string | null,
	): string {
		if (configFile) return configFile;
		return join(analysisRoot, "_planetnik_landscape", "config.json");
	}

	private getLandscapeInfoFile(analysisRoot: string): string {
		return join(analysisRoot, "_planetnik_landscape", "info.json");
	}

	private getNewConfig(
		analysisRoot: string,
		landscapeConfigFile: string,
	): LandscapeConfiguration {
		const initiator = new LandscapeAnalysisInitiator();
		return initiator.initConfiguration(
			analysisRoot,
			landscapeConfigFile,
			false,
		);
	}

	private save(
		configFile: string,
		infoFile: string,
		config: LandscapeConfiguration,
	): void {
		const configDir = dirname(configFile);
		if (!existsSync(configDir)) {
			mkdirSync(configDir, { recursive: true });
		}

		const info = new LandscapeInfo();
		info.subLandscapes = config.subLandscapes;
		info.repositories = config.repositories;
		writeFileSync(infoFile, JSON.stringify(info, null, 2), "utf-8");
		writeFileSync(configFile, JSON.stringify(config, null, 2), "utf-8");
	}
}
