import { Schema } from "@effect/schema";
import { Elysia } from "elysia";
import { auth } from "../../lib/auth.js";
import { ensurePersonalWorkspace } from "../../lib/personal-workspace.js";

const WorkspaceSchema = Schema.Struct({
	id: Schema.String,
	slug: Schema.String,
	name: Schema.String,
	ownerUserId: Schema.String,
	createdAt: Schema.String,
	updatedAt: Schema.String,
});

const WorkspacesResponseSchema = Schema.Struct({
	workspaces: Schema.Array(WorkspaceSchema),
});

const decodeWorkspacesResponse = Schema.decodeUnknownSync(
	WorkspacesResponseSchema,
);

export const workspaceRoutes = new Elysia({ name: "workspaces" }).get(
	"/api/workspaces",
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

		return decodeWorkspacesResponse({
			workspaces: [
				{
					id: personalWorkspace.id,
					slug: personalWorkspace.slug,
					name: personalWorkspace.name,
					ownerUserId: personalWorkspace.ownerUserId,
					createdAt: personalWorkspace.createdAt.toISOString(),
					updatedAt: personalWorkspace.updatedAt.toISOString(),
				},
			],
		});
	},
);
