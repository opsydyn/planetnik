import { Schema } from "@effect/schema";
import { Elysia, t } from "elysia";
import { auth } from "../../lib/auth.js";
import {
	createWorkspaceReport,
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

const CreateReportBodySchema = t.Object({
	name: t.String({
		minLength: 1,
		maxLength: 120,
	}),
	analysisRoot: t.Optional(
		t.String({
			minLength: 1,
			maxLength: 4096,
		}),
	),
});

const CreateReportResponseSchema = Schema.Struct({
	report: ReportSchema,
});

const decodeReportsResponse = Schema.decodeUnknownSync(ReportsResponseSchema);
const decodeCreateReportResponse = Schema.decodeUnknownSync(
	CreateReportResponseSchema,
);

export const reportRoutes = new Elysia({ name: "reports" })
	.get("/api/reports", async ({ request }) => {
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
	})
	.post(
		"/api/reports",
		async ({ request, body }) => {
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
			const created = await createWorkspaceReport({
				workspaceId: personalWorkspace.id,
				name: body.name.trim(),
				analysisRoot: body.analysisRoot?.trim() || null,
			});

			return decodeCreateReportResponse({
				report: {
					id: created.id,
					workspaceId: created.workspaceId,
					slug: created.slug,
					name: created.name,
					kind: created.kind,
					status: created.status,
					analysisRoot: created.analysisRoot ?? null,
					createdAt: created.createdAt.toISOString(),
					updatedAt: created.updatedAt.toISOString(),
					lastSyncedAt: created.lastSyncedAt?.toISOString() ?? null,
				},
			});
		},
		{
			body: CreateReportBodySchema,
		},
	);
