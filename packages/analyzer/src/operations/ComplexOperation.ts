import { RegexUtils } from "@planetnik/common";
import type { OperationStatement } from "./OperationStatement.js";

export class ComplexOperation {
	private operations: OperationStatement[];

	constructor(operations: OperationStatement[] = []) {
		this.operations = operations;
	}

	exec(input: string): string {
		let result = input;
		for (const op of this.operations) {
			result = ComplexOperation.execSingle(op, result);
		}
		return result;
	}

	private static execSingle(op: OperationStatement, input: string): string {
		switch (op.op.toLowerCase()) {
			case "extract": {
				if (op.params.length === 0) return input;
				let result = input;
				for (const pattern of op.params) {
					const matched = RegexUtils.getMatchedRegex(result, pattern);
					result = matched || "";
				}
				return result;
			}
			case "remove": {
				if (op.params.length === 0) return input;
				let result = input;
				for (const pattern of op.params) {
					try {
						result = result.replace(new RegExp(pattern, "g"), "");
					} catch {
						// skip invalid regex
					}
				}
				return result;
			}
			case "replace": {
				if (op.params.length < 2) return input;
				let result = input;
				for (let i = 0; i + 1 < op.params.length; i += 2) {
					const pattern = op.params[i]!;
					const replacement = op.params[i + 1]!;
					try {
						if (pattern === ".*") {
							result = replacement;
						} else {
							result = result.replace(new RegExp(pattern, "g"), replacement);
						}
					} catch {
						// skip invalid regex
					}
				}
				return result;
			}
			case "trim":
				return input.trim();
			case "uppercase":
				return input.toUpperCase();
			case "lowercase":
				return input.toLowerCase();
			case "append": {
				let result = input;
				for (const param of op.params) {
					result += param;
				}
				return result;
			}
			case "prepend": {
				let prefix = "";
				for (const param of op.params) {
					prefix += param;
				}
				return prefix + input;
			}
			default:
				return input;
		}
	}
}
