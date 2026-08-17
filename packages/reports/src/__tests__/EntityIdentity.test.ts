import { describe, expect, test } from "bun:test";
import {
	ENTITY_ID_POLICY,
	componentEntityId,
	contributorEntityId,
	fileEntityId,
	repositoryEntityId,
	unitEntityId,
} from "../exporters/EntityIdentity.js";

describe("snapshot entity identity", () => {
	test("normalises stable IDs without changing the existing route grammar", () => {
		expect(repositoryEntityId("acme\\platform")).toBe("repo:acme/platform");
		expect(fileEntityId("./src\\routes\\index.ts")).toBe(
			"file:src/routes/index.ts",
		);
		expect(unitEntityId("src/routes/index.ts", 42)).toBe(
			"unit:src/routes/index.ts:42",
		);
		expect(componentEntityId("primary", "Billing")).toBe(
			"component:primary:Billing",
		);
		expect(contributorEntityId(" Alice@Example.COM ")).toBe(
			"contributor:alice@example.com",
		);
	});

	test("publishes the identity policy used by manifests", () => {
		expect(ENTITY_ID_POLICY).toEqual({
			repository: "repo:<normalised repository key>",
			file: "file:<normalised relative path>",
			unit: "unit:<normalised relative path>:<start line>",
			component: "component:<decomposition key>:<component name>",
			contributor: "contributor:<lowercase trimmed email>",
		});
	});
});
