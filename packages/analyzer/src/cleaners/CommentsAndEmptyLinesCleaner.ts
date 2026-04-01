import type { CleanedContent } from "./CleanedContent.js";
import { SourceCodeCleanerUtils } from "./SourceCodeCleanerUtils.js";

interface BlockParser {
	startMarker: string;
	endMarker: string;
	escapeMarker: string;
	isComment: boolean;
}

export class CommentsAndEmptyLinesCleaner {
	private parsers: BlockParser[] = [];

	addCommentBlockHelper(
		startMarker: string,
		endMarker: string,
		escapeMarker: string = "",
	): this {
		this.parsers.push({
			startMarker,
			endMarker,
			escapeMarker,
			isComment: true,
		});
		return this;
	}

	addStringBlockHelper(
		startMarker: string,
		endMarker: string,
		escapeMarker: string = "",
	): this {
		this.parsers.push({
			startMarker,
			endMarker,
			escapeMarker,
			isComment: false,
		});
		return this;
	}

	clean(content: string): CleanedContent {
		const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content);
		const cleaned = this.removeBlocks(normalized);
		return SourceCodeCleanerUtils.cleanEmptyLinesWithLineIndexes(cleaned);
	}

	cleanKeepEmptyLines(content: string): string {
		const normalized = SourceCodeCleanerUtils.normalizeLineEnds(content);
		return this.removeBlocks(normalized);
	}

	private removeBlocks(content: string): string {
		let result = content;
		let pos = 0;

		while (pos < result.length) {
			let earliestStart = -1;
			let matchedParser: BlockParser | null = null;

			// Find earliest block start
			for (const parser of this.parsers) {
				const idx = result.indexOf(parser.startMarker, pos);
				if (idx >= 0 && (earliestStart < 0 || idx < earliestStart)) {
					earliestStart = idx;
					matchedParser = parser;
				}
			}

			if (earliestStart < 0 || !matchedParser) break;

			// Find end of block
			const searchFrom = earliestStart + matchedParser.startMarker.length;
			let endIdx = this.findEndMarker(result, searchFrom, matchedParser);

			if (endIdx < 0) {
				// No closing marker — remove rest of content if comment, else skip
				if (matchedParser.isComment) {
					result = result.substring(0, earliestStart);
				}
				break;
			}

			endIdx += matchedParser.endMarker.length;

			// Replace block content
			const blockContent = result.substring(earliestStart, endIdx);
			const replacement = matchedParser.isComment
				? blockContent.replace(/[^\n]/g, "") // preserve newlines for line tracking
				: matchedParser.startMarker + matchedParser.endMarker; // empty string literal

			result =
				result.substring(0, earliestStart) +
				replacement +
				result.substring(endIdx);
			pos = earliestStart + replacement.length;
		}

		return result;
	}

	private findEndMarker(
		content: string,
		from: number,
		parser: BlockParser,
	): number {
		let pos = from;
		while (pos < content.length) {
			const idx = content.indexOf(parser.endMarker, pos);
			if (idx < 0) return -1;

			// Check if escaped
			if (parser.escapeMarker && idx > 0) {
				const before = content.substring(
					Math.max(0, idx - parser.escapeMarker.length),
					idx,
				);
				if (before === parser.escapeMarker) {
					pos = idx + parser.endMarker.length;
					continue;
				}
			}

			return idx;
		}
		return -1;
	}
}
