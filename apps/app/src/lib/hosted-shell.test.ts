import { describe, expect, test } from "bun:test";
import {
	buildHostedBrandModel,
	buildHostedReportShellContext,
	buildHostedRepositoryShellContext,
	buildHostedShellModel,
	isHostedNavItemActive,
} from "./hosted-shell.js";

describe("hosted shell", () => {
	test("uses public chrome with no sidebar for auth pages", () => {
		const shell = buildHostedShellModel({
			title: "Sign in",
			subtitle: "Access the hosted app",
			currentPath: "/sign-in",
			userEmail: null,
			context: {
				kind: "public",
			},
		});

		expect(shell.chrome).toBe("public");
		expect(shell.navSections).toEqual([]);
		expect(shell.breadcrumbs).toEqual([]);
		expect(shell.sessionLabel).toBe("Hosted app access");
	});

	test("uses application chrome for the signed-in dashboard", () => {
		const shell = buildHostedShellModel({
			title: "Hosted intelligence dashboard",
			subtitle: "Workspace summary",
			currentPath: "/",
			userEmail: "alan@example.com",
			context: {
				kind: "dashboard",
			},
		});

		expect(shell.chrome).toBe("application");
		expect(shell.scopeLabel).toBe("Hosted workspace");
		expect(shell.navSections).toEqual([
			{
				label: "Workspace",
				items: [{ href: "/", label: "Dashboard" }],
			},
		]);
	});

	test("builds report navigation for a single-repository report", () => {
		const shell = buildHostedShellModel({
			title: "Overview",
			subtitle: "Connected single repository report",
			currentPath: "/reports/effect-ts/overview",
			userEmail: "alan@example.com",
			context: buildHostedReportShellContext({
				report: {
					id: "report-1",
					workspaceId: "workspace-1",
					slug: "effect-ts",
					name: "Effect TS",
					kind: "planetnik-report",
					status: "connected",
					analysisRoot: "/datasets/effect-ts/data",
					createdAt: "2026-04-02T17:20:19.145Z",
					updatedAt: "2026-04-02T17:20:19.145Z",
					lastSyncedAt: "2026-04-02T17:20:19.145Z",
				},
				context: {
					mode: "single_repository",
					reportMode: "single_repository",
					title: "Effect TS",
					rootRoute: "/",
					dataVersion: 1,
					source: "analysisResults",
					hasLandscape: false,
					hasSingleRepositoryAnalysis: true,
					primaryNavigation: ["overview", "files", "contributors"],
				},
				artifact: null,
			}),
		});

		expect(shell.chrome).toBe("application");
		expect(shell.scopeLabel).toBe("Report for Effect TS");
		expect(shell.navSections.map((section) => section.label)).toEqual([
			"Overview",
			"Structure",
			"Files",
			"Units",
			"Team",
			"Quality",
		]);
		expect(shell.navSections[0]?.items).toEqual([
			{ href: "/reports/effect-ts", label: "Report Details" },
			{ href: "/reports/effect-ts/overview", label: "Overview" },
			{ href: "/reports/effect-ts/metrics", label: "Metrics" },
		]);
		expect(shell.breadcrumbs).toEqual([
			{ label: "Home", href: "/" },
			{ label: "Effect TS", href: "/reports/effect-ts/overview" },
			{ label: "Overview" },
		]);
	});

	test("builds portfolio navigation for landscape reports", () => {
		const shell = buildHostedShellModel({
			title: "Security",
			subtitle: "Landscape dependency health",
			currentPath: "/reports/platform-landscape/security",
			userEmail: "alan@example.com",
			context: buildHostedReportShellContext({
				report: {
					id: "report-2",
					workspaceId: "workspace-1",
					slug: "platform-landscape",
					name: "Platform Landscape",
					kind: "planetnik-report",
					status: "connected",
					analysisRoot: "/datasets/platform-landscape/data",
					createdAt: "2026-04-02T17:20:19.145Z",
					updatedAt: "2026-04-02T17:20:19.145Z",
					lastSyncedAt: "2026-04-02T17:20:19.145Z",
				},
				context: {
					mode: "landscape",
					reportMode: "landscape",
					title: "Platform Landscape",
					rootRoute: "/landscape",
					dataVersion: 1,
					source: "landscape",
					hasLandscape: true,
					hasSingleRepositoryAnalysis: false,
					primaryNavigation: ["overview", "repositories"],
				},
				artifact: null,
			}),
		});

		expect(shell.navSections).toEqual([
			{
				label: "Overview",
				items: [
					{
						href: "/reports/platform-landscape/overview",
						label: "Landscape Dashboard",
					},
					{ href: "/reports/platform-landscape", label: "Report Details" },
				],
			},
			{
				label: "Landscape",
				items: [
					{
						href: "/reports/platform-landscape/repositories",
						label: "Repositories",
					},
					{
						href: "/reports/platform-landscape/contributors",
						label: "Contributors",
					},
					{
						href: "/reports/platform-landscape/topology",
						label: "Team Topology",
					},
					{
						href: "/reports/platform-landscape/security",
						label: "Dependency Security",
					},
				],
			},
		]);
	});

	test("keeps repo drilldown navigation anchored in the landscape inventory", () => {
		const shell = buildHostedShellModel({
			title: "Metrics",
			subtitle: "Repository metrics summary",
			currentPath: "/reports/platform-landscape/repositories/catalog-api/metrics",
			userEmail: "alan@example.com",
			context: buildHostedRepositoryShellContext(
				{
					report: {
						id: "report-2",
						workspaceId: "workspace-1",
						slug: "platform-landscape",
						name: "Platform Landscape",
						kind: "planetnik-report",
						status: "connected",
						analysisRoot: "/datasets/platform-landscape/data",
						createdAt: "2026-04-02T17:20:19.145Z",
						updatedAt: "2026-04-02T17:20:19.145Z",
						lastSyncedAt: "2026-04-02T17:20:19.145Z",
					},
					context: {
						mode: "landscape",
						reportMode: "landscape",
						title: "Platform Landscape",
						rootRoute: "/landscape",
						dataVersion: 1,
						source: "landscape",
						hasLandscape: true,
						hasSingleRepositoryAnalysis: false,
						primaryNavigation: ["overview", "repositories"],
					},
					artifact: null,
				},
				{
					repoKey: "catalog-api",
					name: "Catalog API",
				},
			),
		});

		expect(shell.navSections[0]).toEqual({
			label: "Landscape",
			items: [
				{
					href: "/reports/platform-landscape/overview",
					label: "Landscape Dashboard",
				},
				{
					href: "/reports/platform-landscape/repositories",
					label: "Repositories",
				},
				{
					href: "/reports/platform-landscape/contributors",
					label: "Contributors",
				},
				{
					href: "/reports/platform-landscape/topology",
					label: "Team Topology",
				},
				{
					href: "/reports/platform-landscape/security",
					label: "Dependency Security",
				},
			],
		});
	});

	test("encodes repo route params in repository breadcrumbs and drilldown links", () => {
		const shell = buildHostedShellModel({
			title: "Metrics",
			subtitle: "Repository metrics summary",
			currentPath:
				"/reports/platform-landscape/repositories/acme$2Fcatalog-api/metrics",
			userEmail: "alan@example.com",
			context: buildHostedRepositoryShellContext(
				{
					report: {
						id: "report-2",
						workspaceId: "workspace-1",
						slug: "platform-landscape",
						name: "Platform Landscape",
						kind: "planetnik-report",
						status: "connected",
						analysisRoot: "/datasets/platform-landscape/data",
						createdAt: "2026-04-02T17:20:19.145Z",
						updatedAt: "2026-04-02T17:20:19.145Z",
						lastSyncedAt: "2026-04-02T17:20:19.145Z",
					},
					context: {
						mode: "landscape",
						reportMode: "landscape",
						title: "Platform Landscape",
						rootRoute: "/landscape",
						dataVersion: 1,
						source: "landscape",
						hasLandscape: true,
						hasSingleRepositoryAnalysis: false,
						primaryNavigation: ["overview", "repositories"],
					},
					artifact: null,
				},
				{
					repoKey: "acme/catalog-api",
					name: "Catalog API",
				},
			),
		});

		expect(shell.navSections[1]?.items[0]?.href).toBe(
			"/reports/platform-landscape/repositories/acme$2Fcatalog-api",
		);
		expect(shell.breadcrumbs[3]).toEqual({
			label: "Catalog API",
			href: "/reports/platform-landscape/repositories/acme$2Fcatalog-api",
		});
	});

	test("builds repository drilldown navigation and scope label", () => {
		const shell = buildHostedShellModel({
			title: "Metrics",
			subtitle: "Repository metrics summary",
			currentPath: "/reports/platform-landscape/repositories/catalog-api/metrics",
			userEmail: "alan@example.com",
			context: buildHostedRepositoryShellContext(
				{
					report: {
						id: "report-2",
						workspaceId: "workspace-1",
						slug: "platform-landscape",
						name: "Platform Landscape",
						kind: "planetnik-report",
						status: "connected",
						analysisRoot: "/datasets/platform-landscape/data",
						createdAt: "2026-04-02T17:20:19.145Z",
						updatedAt: "2026-04-02T17:20:19.145Z",
						lastSyncedAt: "2026-04-02T17:20:19.145Z",
					},
					context: {
						mode: "landscape",
						reportMode: "landscape",
						title: "Platform Landscape",
						rootRoute: "/landscape",
						dataVersion: 1,
						source: "landscape",
						hasLandscape: true,
						hasSingleRepositoryAnalysis: false,
						primaryNavigation: ["overview", "repositories"],
					},
					artifact: null,
				},
				{
					repoKey: "catalog-api",
					name: "Catalog API",
				},
			),
		});

		expect(shell.scopeLabel).toBe("Landscape for Platform Landscape • Catalog API");
		expect(shell.navSections.map((section) => section.label)).toEqual([
			"Landscape",
			"Repository",
			"Structure",
			"Files",
			"Units",
			"Team",
			"Quality",
		]);
		expect(shell.navSections[1]?.items).toEqual([
			{
				href: "/reports/platform-landscape/repositories/catalog-api",
				label: "Catalog API Dashboard",
			},
			{
				href: "/reports/platform-landscape/repositories/catalog-api/metrics",
				label: "Metrics",
			},
			{
				href: "/reports/platform-landscape/repositories/catalog-api/commits",
				label: "Commits",
			},
		]);
		expect(shell.breadcrumbs).toEqual([
			{ label: "Home", href: "/" },
			{ label: "Platform Landscape", href: "/reports/platform-landscape/overview" },
			{
				label: "Repositories",
				href: "/reports/platform-landscape/repositories",
			},
			{
				label: "Catalog API",
				href: "/reports/platform-landscape/repositories/catalog-api",
			},
			{ label: "Metrics" },
		]);
	});

	test("matches descendant routes as active navigation links", () => {
		expect(
			isHostedNavItemActive(
				"/reports/platform-landscape/repositories/catalog-api/contributors/alan%40example.com",
				"/reports/platform-landscape/repositories/catalog-api/contributors",
			),
		).toBe(true);
		expect(
			isHostedNavItemActive(
				"/reports/effect-ts/metrics",
				"/reports/effect-ts/overview",
			),
		).toBe(false);
		expect(isHostedNavItemActive("/", "/")).toBe(true);
	});

	test("builds a reusable wordmark brand model", () => {
		expect(buildHostedBrandModel({
			href: "/",
			variant: "sidebar",
		})).toEqual({
			href: "/",
			variant: "sidebar",
			kicker: "Planetnik",
			title: "Hosted Intelligence",
			subtitle: null,
		});
		expect(buildHostedBrandModel({
			href: "/",
			variant: "topbar",
			subtitle: "Report shell",
		})).toEqual({
			href: "/",
			variant: "topbar",
			kicker: "Planetnik",
			title: "Hosted Intelligence",
			subtitle: "Report shell",
		});
	});
});
