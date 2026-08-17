import { route } from "./route";

type ReloadRouteMatcher = string | RegExp;

const base = (import.meta.env?.BASE_URL ?? "").replace(/\/$/, "");
const basePattern = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const reloadRouteMatchers: ReloadRouteMatcher[] = [
	route("/topology"),
	route("/code-city"),
	route("/files/temporal"),
	route("/landscape/topology"),
	new RegExp(`^${basePattern}\\/landscape\\/repositories\\/[^/]+\\/topology$`),
	new RegExp(`^${basePattern}\\/landscape\\/repositories\\/[^/]+\\/code-city$`),
	new RegExp(
		`^${basePattern}\\/landscape\\/repositories\\/[^/]+\\/files\\/temporal$`,
	),
];

function normalizeRoute(r: string): string {
	const [path] = r.split(/[?#]/, 1);
	if (!path || path === "") return route("/");
	return path !== route("/") ? path.replace(/\/+$/, "") : path;
}

export function shouldBypassClientRouter(r: string): boolean {
	const normalizedRoute = normalizeRoute(r);

	return reloadRouteMatchers.some((matcher) =>
		typeof matcher === "string"
			? matcher === normalizedRoute
			: matcher.test(normalizedRoute),
	);
}
