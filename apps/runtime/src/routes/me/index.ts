import { Schema } from "@effect/schema";
import { Elysia } from "elysia";
import { auth } from "../../lib/auth.js";

const MeResponseSchema = Schema.Struct({
	user: Schema.Struct({
		id: Schema.String,
		email: Schema.String,
		name: Schema.NullOr(Schema.String),
		image: Schema.NullOr(Schema.String),
		emailVerified: Schema.Boolean,
	}),
	session: Schema.Struct({
		id: Schema.String,
		userId: Schema.String,
		expiresAt: Schema.String,
	}),
});

const decodeMeResponse = Schema.decodeUnknownSync(MeResponseSchema);

export const meRoutes = new Elysia({ name: "me" }).get(
	"/api/me",
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

		return decodeMeResponse({
			user: {
				id: session.user.id,
				email: session.user.email,
				name: session.user.name ?? null,
				image: session.user.image ?? null,
				emailVerified: session.user.emailVerified,
			},
			session: {
				id: session.session.id,
				userId: session.session.userId,
				expiresAt: session.session.expiresAt.toISOString(),
			},
		});
	},
);
