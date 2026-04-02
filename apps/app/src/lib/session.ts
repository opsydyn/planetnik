export type AuthUser = {
	readonly id: string;
	readonly email: string;
	readonly name?: string | null;
	readonly image?: string | null;
	readonly [key: string]: unknown;
};

export type AuthSession = {
	readonly id?: string;
	readonly userId?: string;
	readonly expiresAt?: string;
	readonly token?: string;
	readonly [key: string]: unknown;
};

type SessionResponse = {
	readonly user?: AuthUser | null;
	readonly session?: AuthSession | null;
};

import { SERVER_BASE_URL } from "./constants.js";

export async function resolveSession(
	request: Request,
): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
	const cookie = request.headers.get("cookie");
	if (!cookie) {
		return {
			user: null,
			session: null,
		};
	}

	try {
		const response = await fetch(`${SERVER_BASE_URL}/api/auth/get-session`, {
			headers: {
				cookie,
			},
		});

		if (!response.ok) {
			return {
				user: null,
				session: null,
			};
		}

		const data = (await response.json()) as SessionResponse;
		return {
			user: data.user ?? null,
			session: data.session ?? null,
		};
	} catch {
		return {
			user: null,
			session: null,
		};
	}
}
