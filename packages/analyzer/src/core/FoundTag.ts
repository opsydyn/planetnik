import type { TagRuleType } from "./TagRule.js";

export class FoundTag {
	tag: string;
	color: string;
	evidence: string;

	constructor(tagRule: TagRuleType, evidence: string) {
		this.tag = tagRule.tag;
		this.color = tagRule.color;
		this.evidence = evidence;
	}
}
