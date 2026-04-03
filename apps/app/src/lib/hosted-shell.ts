import type {
	RuntimeReportDetail,
} from "./runtime-client.js";

export type HostedNavItem = {
	readonly href: string;
	readonly label: string;
};

export type HostedNavSection = {
	readonly label: string;
	readonly items: ReadonlyArray<HostedNavItem>;
};

export type HostedBreadcrumb = {
	readonly label: string;
	readonly href?: string;
};

export type HostedBrandModel = {
	readonly href: string;
	readonly variant: "sidebar" | "topbar";
	readonly kicker: string;
	readonly title: string;
	readonly subtitle: string | null;
};

export type HostedShellContext =
	| {
			readonly kind: "public";
	  }
	| {
			readonly kind: "dashboard";
	  }
	| {
			readonly kind: "report";
			readonly reportSlug: string;
			readonly reportTitle: string;
			readonly reportMode: "single_repository" | "landscape";
	  }
	| {
			readonly kind: "repository";
			readonly reportSlug: string;
			readonly reportTitle: string;
			readonly reportMode: "landscape";
			readonly repoKey: string;
			readonly repoName: string;
	  };

export type HostedShellModel = {
	readonly chrome: "public" | "application";
	readonly brand: HostedBrandModel;
	readonly navSections: ReadonlyArray<HostedNavSection>;
	readonly breadcrumbs: ReadonlyArray<HostedBreadcrumb>;
	readonly scopeLabel: string | null;
	readonly sessionLabel: string;
	readonly pageTitle: string;
	readonly subtitle: string;
};

type BuildHostedShellModelInput = {
	readonly title: string;
	readonly subtitle: string;
	readonly currentPath: string;
	readonly userEmail: string | null;
	readonly context?: HostedShellContext;
};

type RepositoryScope = {
	readonly repoKey: string;
	readonly name: string;
};

export function buildHostedBrandModel(input: {
	readonly href: string;
	readonly variant: "sidebar" | "topbar";
	readonly subtitle?: string;
}): HostedBrandModel {
	return {
		href: input.href,
		variant: input.variant,
		kicker: "Planetnik",
		title: "Hosted Intelligence",
		subtitle: input.subtitle ?? null,
	};
}

export function buildHostedReportShellContext(
	reportDetail: RuntimeReportDetail,
): HostedShellContext {
	return {
		kind: "report",
		reportSlug: reportDetail.report.slug,
		reportTitle: reportDetail.report.name,
		reportMode: reportDetail.context?.reportMode ?? "single_repository",
	};
}

export function buildHostedRepositoryShellContext(
	reportDetail: RuntimeReportDetail,
	repository: RepositoryScope,
): HostedShellContext {
	return {
		kind: "repository",
		reportSlug: reportDetail.report.slug,
		reportTitle: reportDetail.report.name,
		reportMode: "landscape",
		repoKey: repository.repoKey,
		repoName: repository.name,
	};
}

export function isHostedNavItemActive(currentPath: string, href: string): boolean {
	if (href === "/") {
		return currentPath === href;
	}

	if (currentPath === href) {
		return true;
	}

	return currentPath.startsWith(`${href}/`);
}

export function buildHostedShellModel(
	input: BuildHostedShellModelInput,
): HostedShellModel {
	const context = input.context ?? { kind: "public" } satisfies HostedShellContext;
	const sessionLabel = input.userEmail
		? `Session: ${input.userEmail}`
		: "Hosted app access";

	if (context.kind === "public") {
		return {
			chrome: "public",
			brand: buildHostedBrandModel({
				href: "/sign-in",
				variant: "topbar",
				subtitle: "Hosted app",
			}),
			navSections: [],
			breadcrumbs: [],
			scopeLabel: null,
			sessionLabel,
			pageTitle: input.title,
			subtitle: input.subtitle,
		};
	}

	if (context.kind === "dashboard") {
		return {
			chrome: "application",
			brand: buildHostedBrandModel({
				href: "/",
				variant: "sidebar",
			}),
			navSections: [
				{
					label: "Workspace",
					items: [{ href: "/", label: "Dashboard" }],
				},
			],
			breadcrumbs: [{ label: "Home" }, { label: input.title }],
			scopeLabel: "Hosted workspace",
			sessionLabel,
			pageTitle: input.title,
			subtitle: input.subtitle,
		};
	}

	if (context.kind === "report") {
		return {
			chrome: "application",
			brand: buildHostedBrandModel({
				href: "/",
				variant: "sidebar",
			}),
			navSections: buildReportNavSections(context),
			breadcrumbs: [
				{ label: "Home", href: "/" },
				{
					label: context.reportTitle,
					href: `/reports/${context.reportSlug}/overview`,
				},
				{ label: input.title },
			],
			scopeLabel:
				context.reportMode === "landscape"
					? `Landscape for ${context.reportTitle}`
					: `Report for ${context.reportTitle}`,
			sessionLabel,
			pageTitle: input.title,
			subtitle: input.subtitle,
		};
	}

	return {
		chrome: "application",
		brand: buildHostedBrandModel({
			href: "/",
			variant: "sidebar",
		}),
		navSections: buildRepositoryNavSections(context),
		breadcrumbs: [
			{ label: "Home", href: "/" },
			{
				label: context.reportTitle,
				href: `/reports/${context.reportSlug}/overview`,
			},
			{
				label: context.repoName,
				href: `/reports/${context.reportSlug}/repositories/${context.repoKey}`,
			},
			{ label: input.title },
		],
		scopeLabel: `Landscape for ${context.reportTitle} • ${context.repoName}`,
		sessionLabel,
		pageTitle: input.title,
		subtitle: input.subtitle,
	};
}

function buildReportNavSections(
	context: Extract<HostedShellContext, { kind: "report" }>,
): ReadonlyArray<HostedNavSection> {
	const baseHref = `/reports/${context.reportSlug}`;
	const sections: HostedNavSection[] = [
		{
			label: "Overview",
			items: [
				{ href: baseHref, label: "Report Details" },
				{ href: `${baseHref}/overview`, label: "Overview" },
				{ href: `${baseHref}/metrics`, label: "Metrics" },
			],
		},
		{
			label: "Structure",
			items: [
				{ href: `${baseHref}/dependencies`, label: "Dependencies" },
				{ href: `${baseHref}/duplication`, label: "Duplication" },
			],
		},
		{
			label: "Files",
			items: [
				{ href: `${baseHref}/files/size`, label: "File Size" },
				{ href: `${baseHref}/files/age`, label: "File Age" },
				{ href: `${baseHref}/files/churn`, label: "File Churn" },
				{ href: `${baseHref}/files/temporal`, label: "Temporal Dependencies" },
			],
		},
		{
			label: "Units",
			items: [
				{ href: `${baseHref}/units/size`, label: "Unit Size" },
				{
					href: `${baseHref}/units/complexity`,
					label: "Conditional Complexity",
				},
			],
		},
		{
			label: "Team",
			items: [
				{ href: `${baseHref}/contributors`, label: "Contributors" },
				{ href: `${baseHref}/commits`, label: "Commits" },
				{ href: `${baseHref}/topology`, label: "Team Topology" },
			],
		},
		{
			label: "Quality",
			items: [
				{ href: `${baseHref}/hotspots`, label: "Hotspots" },
				{ href: `${baseHref}/impact`, label: "Impact" },
				{ href: `${baseHref}/controls`, label: "Goals & Controls" },
				{ href: `${baseHref}/trends`, label: "Trends" },
			],
		},
	];

	if (context.reportMode === "landscape") {
		sections.push({
			label: "Security",
			items: [{ href: `${baseHref}/security`, label: "Dependency Security" }],
		});
	}

	return sections;
}

function buildRepositoryNavSections(
	context: Extract<HostedShellContext, { kind: "repository" }>,
): ReadonlyArray<HostedNavSection> {
	const reportHref = `/reports/${context.reportSlug}`;
	const repoHref = `${reportHref}/repositories/${context.repoKey}`;
	const sections: HostedNavSection[] = [
		{
			label: "Report",
			items: [
				{ href: `${reportHref}/overview`, label: "Overview" },
				{ href: `${reportHref}/security`, label: "Dependency Security" },
			],
		},
		{
			label: "Repository",
			items: [
				{ href: repoHref, label: `${context.repoName} Dashboard` },
				{ href: `${repoHref}/metrics`, label: "Metrics" },
				{ href: `${repoHref}/commits`, label: "Commits" },
			],
		},
		{
			label: "Structure",
			items: [
				{ href: `${repoHref}/components`, label: "Components" },
				{ href: `${repoHref}/coupling`, label: "Balanced Coupling" },
				{ href: `${repoHref}/dependencies`, label: "Dependencies" },
				{ href: `${repoHref}/duplication`, label: "Duplication" },
			],
		},
		{
			label: "Files",
			items: [
				{ href: `${repoHref}/files/size`, label: "File Size" },
				{ href: `${repoHref}/files/age`, label: "File Age" },
				{ href: `${repoHref}/files/churn`, label: "File Churn" },
				{
					href: `${repoHref}/files/temporal`,
					label: "Temporal Dependencies",
				},
			],
		},
		{
			label: "Units",
			items: [
				{ href: `${repoHref}/units/size`, label: "Unit Size" },
				{
					href: `${repoHref}/units/complexity`,
					label: "Conditional Complexity",
				},
			],
		},
		{
			label: "Team",
			items: [
				{ href: `${repoHref}/contributors`, label: "Contributors" },
				{ href: `${repoHref}/topology`, label: "Team Topology" },
			],
		},
		{
			label: "Quality",
			items: [
				{ href: `${repoHref}/impact`, label: "Impact" },
				{ href: `${repoHref}/controls`, label: "Goals & Controls" },
			],
		},
	];

	return sections;
}
