export class RichTextRenderingUtils {
	private static showMoreBlockId = 1;

	static getPercentage(value: number, total: number): number {
		if (total === 0) return 0;
		return (100.0 * value) / total;
	}

	static renderNumber(value: number): string {
		return new Intl.NumberFormat("en-US", {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2,
		}).format(value);
	}

	static renderNumberStrong(value: number): string {
		return `<b>${RichTextRenderingUtils.renderNumber(value)}</b>`;
	}

	static renderNumberStrongWithSuffix(
		value: number,
		singular: string,
		plural: string,
	): string {
		const suffix = value === 1 ? singular : plural;
		return `<b>${RichTextRenderingUtils.renderNumber(value)}</b> ${suffix}`;
	}

	static link(url: string, label: string): string {
		return `<a href="${url}">${label}</a>`;
	}

	static getShowMoreParagraph(
		visibleText: string,
		hiddenText: string,
		linkLabel: string,
	): string {
		return `${RichTextRenderingUtils.getStartShowMoreParagraph(visibleText, linkLabel)}${hiddenText}${RichTextRenderingUtils.getEndShowMoreParagraph()}`;
	}

	static getStartShowMoreParagraph(
		visibleText: string,
		linkLabel: string,
	): string {
		const id = `show_more_${RichTextRenderingUtils.showMoreBlockId++}`;
		return `${visibleText} <a href="javascript:void(0)" onclick="document.getElementById('${id}').style.display='inline'">${linkLabel}</a><span id="${id}" style="display:none">`;
	}

	static getEndShowMoreParagraph(): string {
		return "</span>";
	}

	static bold(text: string | number): string {
		return `<b>${text}</b>`;
	}

	static italic(text: string): string {
		return `<i>${text}</i>`;
	}

	static paragraph(text: string): string {
		return `<p>${text}</p>`;
	}

	static getStyledContent(text: string, style: string): string {
		return `<span style="${style}">${text}</span>`;
	}
}
