import { join } from "node:path";

export function resolveLandscapeReportsDir(root: string): string {
	return join(root, "_planetnik_landscape", "reports");
}

export function resolveLandscapeDataDir(root: string): string {
	return join(resolveLandscapeReportsDir(root), "data");
}
