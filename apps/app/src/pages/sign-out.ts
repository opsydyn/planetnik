import type { APIRoute } from "astro";
import { SERVER_BASE_URL } from "../lib/constants.js";

const SIGN_IN_PATH = "/sign-in" as const;
const REDIRECT_STATUS = 302 as const;

type HeadersWithSetCookie = Headers & {
	getSetCookie?: () => string[];
};

function readSetCookieHeaders(headers: Headers): string[] {
	const cookies =
		(headers as HeadersWithSetCookie).getSetCookie?.().filter(Boolean) ?? [];

	if (cookies.length > 0) {
		return cookies;
	}

	const single = headers.get("set-cookie");
	return single ? [single] : [];
}

export const GET: APIRoute = async ({ request }) => {
	const cookie = request.headers.get("cookie");
	const response = await fetch(`${SERVER_BASE_URL}/api/auth/sign-out`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...(cookie ? { cookie } : {}),
		},
		body: JSON.stringify({}),
		redirect: "manual",
	});

	const headers = new Headers({
		location: SIGN_IN_PATH,
		"cache-control": "no-store, no-cache, must-revalidate, max-age=0",
		pragma: "no-cache",
		expires: "0",
	});

	for (const value of readSetCookieHeaders(response.headers)) {
		headers.append("set-cookie", value);
	}

	return new Response(null, {
		status: REDIRECT_STATUS,
		headers,
	});
};
