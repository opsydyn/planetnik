import { describe, expect, test } from "bun:test";
import { parseLinkHeader } from "../github/parseLinkHeader.js";

describe("parseLinkHeader", () => {
	test("returns empty object for null/undefined/empty input", () => {
		expect(parseLinkHeader(null)).toEqual({});
		expect(parseLinkHeader(undefined)).toEqual({});
		expect(parseLinkHeader("")).toEqual({});
	});

	test("parses a single next link", () => {
		const header =
			'<https://api.github.com/repos/octocat/hello/dependabot/alerts?after=abc123&per_page=30>; rel="next"';
		const result = parseLinkHeader(header);
		expect(result.next).toBe(
			"https://api.github.com/repos/octocat/hello/dependabot/alerts?after=abc123&per_page=30",
		);
		expect(result.prev).toBeUndefined();
	});

	test("parses a single prev link", () => {
		const header =
			'<https://api.github.com/repos/octocat/hello/dependabot/alerts?before=xyz789&per_page=30>; rel="prev"';
		const result = parseLinkHeader(header);
		expect(result.prev).toBe(
			"https://api.github.com/repos/octocat/hello/dependabot/alerts?before=xyz789&per_page=30",
		);
		expect(result.next).toBeUndefined();
	});

	test("parses both next and prev links", () => {
		const header =
			'<https://api.github.com/repos/o/r/dependabot/alerts?after=cur2&per_page=30>; rel="next", ' +
			'<https://api.github.com/repos/o/r/dependabot/alerts?before=cur1&per_page=30>; rel="prev"';
		const result = parseLinkHeader(header);
		expect(result.next).toBe(
			"https://api.github.com/repos/o/r/dependabot/alerts?after=cur2&per_page=30",
		);
		expect(result.prev).toBe(
			"https://api.github.com/repos/o/r/dependabot/alerts?before=cur1&per_page=30",
		);
	});

	test("parses first and last links (common in GitHub pagination)", () => {
		const header =
			'<https://api.github.com/orgs/effect-TS/repos?page=2&per_page=100>; rel="next", ' +
			'<https://api.github.com/orgs/effect-TS/repos?page=5&per_page=100>; rel="last"';
		const result = parseLinkHeader(header);
		expect(result.next).toBe(
			"https://api.github.com/orgs/effect-TS/repos?page=2&per_page=100",
		);
		expect(result.last).toBe(
			"https://api.github.com/orgs/effect-TS/repos?page=5&per_page=100",
		);
	});

	test("parses all four rels together", () => {
		const header =
			'<https://example.com?page=1>; rel="first", ' +
			'<https://example.com?page=2>; rel="prev", ' +
			'<https://example.com?page=4>; rel="next", ' +
			'<https://example.com?page=10>; rel="last"';
		const result = parseLinkHeader(header);
		expect(result.first).toBe("https://example.com?page=1");
		expect(result.prev).toBe("https://example.com?page=2");
		expect(result.next).toBe("https://example.com?page=4");
		expect(result.last).toBe("https://example.com?page=10");
	});

	test("handles URLs with complex query parameters", () => {
		const header =
			'<https://api.github.com/repos/o/r/alerts?after=ghs_abc%3D%3D&per_page=100&state=open>; rel="next"';
		const result = parseLinkHeader(header);
		expect(result.next).toBe(
			"https://api.github.com/repos/o/r/alerts?after=ghs_abc%3D%3D&per_page=100&state=open",
		);
	});

	test("ignores malformed segments gracefully", () => {
		const header =
			'garbage, <https://example.com?page=2>; rel="next", also-bad';
		const result = parseLinkHeader(header);
		expect(result.next).toBe("https://example.com?page=2");
	});

	test("handles extra whitespace", () => {
		const header =
			'  <https://example.com?page=2>  ;  rel="next"  ,  <https://example.com?page=1>  ;  rel="prev"  ';
		const result = parseLinkHeader(header);
		expect(result.next).toBe("https://example.com?page=2");
		expect(result.prev).toBe("https://example.com?page=1");
	});
});
