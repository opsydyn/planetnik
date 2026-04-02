import { treaty } from "@elysiajs/eden/treaty2";
import type { PlanetnikRuntimeApp } from "../../../runtime/src/app.js";
import { SERVER_BASE_URL } from "./constants.js";

const runtimeClient = treaty<PlanetnikRuntimeApp>(SERVER_BASE_URL);

export type RuntimeMe = {
	readonly user: {
		readonly id: string;
		readonly email: string;
		readonly name: string | null;
		readonly image: string | null;
		readonly emailVerified: boolean;
	};
	readonly session: {
		readonly id: string;
		readonly userId: string;
		readonly expiresAt: string;
	};
};

export type RuntimeWorkspace = {
	readonly id: string;
	readonly slug: string;
	readonly name: string;
	readonly ownerUserId: string;
	readonly createdAt: string;
	readonly updatedAt: string;
};

export type RuntimeReport = {
	readonly id: string;
	readonly workspaceId: string;
	readonly slug: string;
	readonly name: string;
	readonly kind: string;
	readonly status: string;
	readonly analysisRoot: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly lastSyncedAt: string | null;
};

type RuntimeHeaders = {
	readonly headers: {
		readonly cookie: string;
	};
};

function withRuntimeCookie(cookie: string): RuntimeHeaders {
	return {
		headers: {
			cookie,
		},
	};
}

function isTransportResponse(value: unknown): value is Response {
	return value instanceof Response;
}

export async function getRuntimeMe(cookie: string): Promise<RuntimeMe | null> {
	const { data } = await runtimeClient.api.me.get(withRuntimeCookie(cookie));
	if (!data || isTransportResponse(data)) {
		return null;
	}

	return data;
}

export async function getRuntimeWorkspaces(
	cookie: string,
): Promise<ReadonlyArray<RuntimeWorkspace>> {
	const { data } = await runtimeClient.api.workspaces.get(
		withRuntimeCookie(cookie),
	);
	if (!data || isTransportResponse(data)) {
		return [];
	}

	return data.workspaces;
}

export async function getRuntimeReports(
	cookie: string,
): Promise<ReadonlyArray<RuntimeReport>> {
	const { data } = await runtimeClient.api.reports.get(withRuntimeCookie(cookie));
	if (!data || isTransportResponse(data)) {
		return [];
	}

	return data.reports;
}
