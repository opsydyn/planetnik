import { Elysia } from "elysia";
import { appConfig } from "../../config.js";
import { auth } from "../../lib/auth.js";

const HTTP_STATUS_METHOD_NOT_ALLOWED = 405 as const;
const HTTP_STATUS_OK = 200 as const;
const SIGN_OUT_PATH = "/api/auth/sign-out" as const;
const CLEAR_AUTH_COOKIE_NAMES = [
	"better-auth.session_token",
	"better-auth.session_data",
	"better-auth.dont_remember",
	"better-auth.account_data",
	"__Secure-better-auth.session_token",
	"__Secure-better-auth.session_data",
	"__Secure-better-auth.dont_remember",
	"__Secure-better-auth.account_data",
	"__Host-better-auth.session_token",
	"__Host-better-auth.session_data",
	"__Host-better-auth.dont_remember",
	"__Host-better-auth.account_data",
] as const;

const isSignOutRequest = (request: Request): boolean => {
	try {
		return new URL(request.url).pathname === SIGN_OUT_PATH;
	} catch {
		return request.url.endsWith(SIGN_OUT_PATH);
	}
};

const appendExpiredCookie = (
	headers: Headers,
	name: string,
	secure: boolean,
	sameSite: string,
	domain?: string,
): void => {
	const parts = [
		`${name}=`,
		"Max-Age=0",
		"Path=/",
		"HttpOnly",
		`SameSite=${sameSite}`,
	];
	if (secure) {
		parts.push("Secure");
	}
	if (domain) {
		parts.push(`Domain=${domain}`);
	}
	headers.append("set-cookie", parts.join("; "));
};

const signOutFallbackResponse = (): Response => {
	const headers = new Headers({
		"content-type": "application/json",
	});

	for (const name of CLEAR_AUTH_COOKIE_NAMES) {
		appendExpiredCookie(
			headers,
			name,
			false,
			appConfig.authCookies.sameSite,
		);
		appendExpiredCookie(
			headers,
			name,
			true,
			appConfig.authCookies.sameSite,
		);
		if (!appConfig.cookieDomain) {
			continue;
		}
		appendExpiredCookie(
			headers,
			name,
			false,
			appConfig.authCookies.sameSite,
			appConfig.cookieDomain,
		);
		appendExpiredCookie(
			headers,
			name,
			true,
			appConfig.authCookies.sameSite,
			appConfig.cookieDomain,
		);
	}

	return new Response(
		JSON.stringify({
			success: true,
			fallback: true,
		}),
		{
			status: HTTP_STATUS_OK,
			headers,
		},
	);
};

export const authRoutes = new Elysia({ name: "auth" }).all(
	"/api/auth/*",
	async ({ request }) => {
		if (["POST", "GET"].includes(request.method)) {
			try {
				return await auth.handler(request);
			} catch (error) {
				if (request.method === "POST" && isSignOutRequest(request)) {
					console.error(
						"Auth sign-out failed, applying cookie-expire fallback",
						error,
					);
					return signOutFallbackResponse();
				}
				throw error;
			}
		}

		return new Response(null, { status: HTTP_STATUS_METHOD_NOT_ALLOWED });
	},
	{
		parse: "none",
	},
);
