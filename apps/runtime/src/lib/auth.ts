import { type BetterAuthOptions, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { appConfig } from "../config.js";
import { db } from "../db/index.js";
import { account, session, user, verification } from "../db/schema/auth.js";

export const auth = betterAuth<BetterAuthOptions>({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			account,
			session,
			user,
			verification,
		},
	}),
	baseURL: appConfig.betterAuth.baseURL,
	secret: appConfig.betterAuth.secret,
	trustedOrigins: appConfig.corsOrigins,
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
	},
	advanced: {
		defaultCookieAttributes: {
			sameSite: appConfig.authCookies.sameSite,
			secure: appConfig.authCookies.secure,
			httpOnly: true,
			...(appConfig.cookieDomain
				? { domain: appConfig.cookieDomain }
				: {}),
		},
	},
});
