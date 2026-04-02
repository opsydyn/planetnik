import { Schema } from "@effect/schema";
import { Elysia } from "elysia";
import { auth } from "../../lib/auth.js";
import {
	ensurePersonalWorkspace,
	listWorkspaceReports,
} from "../../lib/personal-workspace.js";

const ReportSchema = Schema.Struct({
	id: Schema.String,
	workspaceId: Schema.String,
	slug: Schema.String,
	name: Schema.String,
	kind: Schema.String,
	status: Schema.String,
	analysisRoot: Schema.NullOr(Schema.String),
	createdAt: Schema.String,
	updatedAt: Schema.String,
	lastSyncedAt: Schema.NullOr(Schema.String),
});

const ReportsResponseSchema = Schema.Struct({
	reports: Schema.Array(ReportSchema),
});

const decodeReportsResponse = Schema.decodeUnknownSync(ReportsResponseSchema);

export const reportRoutes = new Elysia({ name: "reports" }).get(
	"/api/reports",
	async ({ request }) => {
		const session = await auth.api.getSession({
			headers: request.headers,
		});

		if (!session?.session || !session.user) {
			return new Response(
				JSON.stringify({
					error: "unauthorized",
				}),
				{
					status: 401,
					headers: {
						"content-type": "application/json",
					},
				},
			);
		}

		const personalWorkspace = await ensurePersonalWorkspace(session);
		const reports = await listWorkspaceReports(personalWorkspace.id);

		return decodeReportsResponse({
			reports: reports.map((item) => ({
				id: item.id,
				workspaceId: item.workspaceId,
				slug: item.slug,
				name: item.name,
				kind: item.kind,
				status: item.status,
				analysisRoot: item.analysisRoot ?? null,
				createdAt: item.createdAt.toISOString(),
				updatedAt: item.updatedAt.toISOString(),
				lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
			})),
		});
	},
);
