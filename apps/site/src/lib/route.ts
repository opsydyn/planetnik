const base = (import.meta.env?.BASE_URL ?? "").replace(/\/$/, "");

export function route(path: string): string {
	if (!base || path.startsWith(`${base}/`)) return path;
	return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
