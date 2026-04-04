type RouteUser = {
	readonly id: string;
	readonly email: string;
	readonly role?: string | null;
};

type RouteAccessInput = {
	readonly pathname: string;
	readonly user: RouteUser | null;
};

type RouteAccessDecision =
	| {
			readonly kind: "allow";
	  }
	| {
			readonly kind: "redirect";
			readonly location: "/" | "/sign-in";
	  };

const AUTH_PAGES = new Set(["/sign-in", "/sign-up"]);

function isAdminPath(pathname: string): boolean {
	return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminUser(user: RouteUser | null): boolean {
	return user?.role === "admin";
}

export function resolveRouteAccess({
	pathname,
	user,
}: RouteAccessInput): RouteAccessDecision {
	if (!user) {
		return AUTH_PAGES.has(pathname)
			? { kind: "allow" }
			: { kind: "redirect", location: "/sign-in" };
	}

	if (AUTH_PAGES.has(pathname)) {
		return { kind: "redirect", location: "/" };
	}

	if (isAdminPath(pathname) && !isAdminUser(user)) {
		return { kind: "redirect", location: "/" };
	}

	return { kind: "allow" };
}
