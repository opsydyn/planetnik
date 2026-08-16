const splitRoute = (route: string): { readonly path: string; readonly suffix: string } => {
	const suffixIndex = route.search(/[?#]/);
	return suffixIndex === -1
		? { path: route, suffix: "" }
		: { path: route.slice(0, suffixIndex), suffix: route.slice(suffixIndex) };
};

const normaliseBaseSegments = (basePath: string): string[] => {
	const segments: string[] = [];
	for (const segment of basePath.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments;
};

const normaliseRouteSegments = (routePath: string): string[] => {
	const segments: string[] = [];
	for (const segment of routePath.split("/")) {
		if (!segment || segment === ".") continue;
		if (segment === "..") {
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments;
};

export function resolveCodeCityEvidenceHref(
	basePath: string,
	route: string | null,
): string | null {
	if (route === null) return null;

	const { path, suffix } = splitRoute(route.trim());
	const segments = [
		...normaliseBaseSegments(basePath),
		...normaliseRouteSegments(path),
	];
	return `/${segments.join("/")}${suffix}`;
}
