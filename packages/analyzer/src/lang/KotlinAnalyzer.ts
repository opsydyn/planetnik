import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js";
import { CStyleAnalyzer } from "./CStyleAnalyzer.js";

export class KotlinAnalyzer extends CStyleAnalyzer {
	protected override duplicationPatterns = [
		"{",
		"}",
		"import .*",
		"package .*",
	];

	protected override createCleaner(): CommentsAndEmptyLinesCleaner {
		return new CommentsAndEmptyLinesCleaner()
			.addCommentBlockHelper("/*", "*/")
			.addCommentBlockHelper("//", "\n")
			.addStringBlockHelper('"', '"', "\\")
			.addStringBlockHelper("'", "'", "\\");
	}
}
