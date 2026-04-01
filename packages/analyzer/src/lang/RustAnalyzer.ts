import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js";
import { CStyleAnalyzer } from "./CStyleAnalyzer.js";

export class RustAnalyzer extends CStyleAnalyzer {
	protected override duplicationPatterns = ["{", "}", "use .*", "mod .*"];

	protected override createCleaner(): CommentsAndEmptyLinesCleaner {
		return new CommentsAndEmptyLinesCleaner()
			.addCommentBlockHelper("/*", "*/")
			.addCommentBlockHelper("//", "\n")
			.addStringBlockHelper('"', '"', "\\")
			.addStringBlockHelper("'", "'", "\\");
	}
}
