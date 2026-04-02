import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { report, workspace } from "../db/schema/app.js";
import type { auth } from "./auth.js";

type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;

function slugifySegment(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 40);
}

function buildWorkspaceName(session: NonNullable<AuthSession>): string {
	const preferredName = session.user.name?.trim();
	if (preferredName) {
		return `${preferredName}'s Workspace`;
	}
	return `${session.user.email} Workspace`;
}

function buildWorkspaceSlug(session: NonNullable<AuthSession>): string {
	const preferredName = session.user.name?.trim();
	const base = preferredName || session.user.email.split("@")[0] || session.user.id;
	const normalized = slugifySegment(base);
	return normalized ? `workspace-${normalized}` : `workspace-${session.user.id.slice(0, 12)}`;
}

export async function ensurePersonalWorkspace(
	session: NonNullable<AuthSession>,
) {
	const existing = await db.query.workspace.findFirst({
		where: eq(workspace.ownerUserId, session.user.id),
	});

	if (existing) {
		return existing;
	}

	const now = new Date();

	await db
		.insert(workspace)
		.values({
			id: crypto.randomUUID(),
			slug: buildWorkspaceSlug(session),
			name: buildWorkspaceName(session),
			ownerUserId: session.user.id,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing({
			target: workspace.ownerUserId,
		});

	const created = await db.query.workspace.findFirst({
		where: eq(workspace.ownerUserId, session.user.id),
	});

	if (!created) {
		throw new Error("Failed to resolve personal workspace after creation");
	}

	return created;
}

export async function listWorkspaceReports(
	workspaceId: string,
) {
	return db.query.report.findMany({
		where: and(eq(report.workspaceId, workspaceId)),
		orderBy: [asc(report.createdAt)],
	});
}

function buildReportSlug(name: string): string {
	const normalized = slugifySegment(name);
	return normalized || "report";
}

async function ensureUniqueReportSlug(
	workspaceId: string,
	baseSlug: string,
): Promise<string> {
	for (let index = 0; index < 100; index += 1) {
		const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
		const existing = await db.query.report.findFirst({
			where: and(
				eq(report.workspaceId, workspaceId),
				eq(report.slug, candidate),
			),
		});

		if (!existing) {
			return candidate;
		}
	}

	throw new Error("Failed to generate a unique report slug");
}

export async function createWorkspaceReport(input: {
	readonly workspaceId: string;
	readonly name: string;
	readonly analysisRoot?: string | null;
}) {
	const now = new Date();
	const slug = await ensureUniqueReportSlug(
		input.workspaceId,
		buildReportSlug(input.name),
	);

	const values = {
		id: crypto.randomUUID(),
		workspaceId: input.workspaceId,
		slug,
		name: input.name,
		kind: "planetnik-report",
		status: input.analysisRoot ? "connected" : "draft",
		analysisRoot: input.analysisRoot ?? null,
		createdAt: now,
		updatedAt: now,
		lastSyncedAt: input.analysisRoot ? now : null,
	} as const;

	await db.insert(report).values(values);

	return values;
}
