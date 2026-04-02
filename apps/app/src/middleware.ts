import { defineMiddleware } from "astro:middleware";
import { resolveSession } from "./lib/session.js";

const AUTH_PAGES = new Set(["/sign-in", "/sign-up"]);

function isBypassedPath(pathname: string): boolean {
	return (
		pathname.startsWith("/_astro/") ||
		pathname === "/sign-out" ||
		pathname === "/favicon.svg"
	);
}

export const onRequest = defineMiddleware(async (context, next) => {
	const path = context.url.pathname;

	if (isBypassedPath(path)) {
		return next();
	}

	const { user, session } = await resolveSession(context.request);
	context.locals.user = user;
	context.locals.session = session;

	if (!user && !AUTH_PAGES.has(path)) {
		return context.redirect("/sign-in");
	}

	if (user && AUTH_PAGES.has(path)) {
		return context.redirect("/");
	}

	return next();
});
