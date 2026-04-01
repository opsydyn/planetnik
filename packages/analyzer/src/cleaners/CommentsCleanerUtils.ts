import { SourceCodeCleanerUtils } from "./SourceCodeCleanerUtils.js";

export class CommentsCleanerUtils {
	static cleanLineComments(content: string, lineCommentStart: string): string {
		const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content);
		let result = normalized;

		while (true) {
			const commentStart = result.indexOf(lineCommentStart);
			if (commentStart < 0) break;
			let commentEnd = result.indexOf("\n", commentStart + 1);
			if (commentEnd < 0) commentEnd = result.length;
			result = result.substring(0, commentStart) + result.substring(commentEnd);
		}

		return result;
	}

	static cleanBlockComments(
		content: string,
		commentBlockStart: string,
		commentBlockEnd: string,
	): string {
		let result = content;
		let commentStartIndex = 0;

		while (true) {
			commentStartIndex = result.indexOf(commentBlockStart, commentStartIndex);
			if (commentStartIndex < 0) break;

			const commentEndIndex = result.indexOf(
				commentBlockEnd,
				commentStartIndex + commentBlockStart.length,
			);
			if (commentEndIndex <= commentStartIndex) break;

			const comment = result.substring(
				commentStartIndex,
				commentEndIndex + commentBlockEnd.length,
			);
			const newlineCount = (comment.match(/\n/g) || []).length;
			const replacement = "\n".repeat(newlineCount);
			result =
				result.substring(0, commentStartIndex) +
				replacement +
				result.substring(commentEndIndex + commentBlockEnd.length);
		}

		return result;
	}
}
