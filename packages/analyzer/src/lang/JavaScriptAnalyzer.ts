import { CommentsAndEmptyLinesCleaner } from "../cleaners/CommentsAndEmptyLinesCleaner.js";
import { CStyleAnalyzer } from "./CStyleAnalyzer.js";

export class JavaScriptAnalyzer extends CStyleAnalyzer {
	protected override duplicationPatterns = ["{", "}", "import.*"];

	protected override createCleaner(): CommentsAndEmptyLinesCleaner {
		return new CommentsAndEmptyLinesCleaner()
			.addCommentBlockHelper("/*", "*/")
			.addCommentBlockHelper("//", "\n")
			.addStringBlockHelper('"', '"', "\\")
			.addStringBlockHelper("'", "'", "\\")
			.addStringBlockHelper("`", "`", "\\")
			.addStringBlockHelper("/", "/", "\\");
	}
}
