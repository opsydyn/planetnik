import { beforeEach, describe, expect, mock, test } from "bun:test";

type CreatedReport = {
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

const createRuntimeReport = mock(
	async (): Promise<CreatedReport | null> => null,
);

mock.module("../../lib/runtime-client.js", () => ({
	createRuntimeReport,
}));

const { POST } = await import("./create.js");

function createRequest(fields: Record<string, string | undefined>) {
	const formData = new FormData();

	for (const [key, value] of Object.entries(fields)) {
		if (typeof value === "string") {
			formData.set(key, value);
		}
	}

	return new Request("http://localhost/reports/create", {
		method: "POST",
		headers: {
			cookie: "better-auth.session_token=test",
		},
		body: formData,
	});
}

function redirect(location: string, status: number) {
	return new Response(null, {
		status,
		headers: {
			location,
		},
	});
}

describe("POST /reports/create", () => {
	beforeEach(() => {
		createRuntimeReport.mockReset();
	});

	test("redirects back to the dashboard when no report source is supplied", async () => {
		const response = await POST({
			request: createRequest({}),
			redirect,
		} as Parameters<typeof POST>[0]);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"/?reportError=missing-name",
		);
		expect(createRuntimeReport).not.toHaveBeenCalled();
	});

	test("redirects back with an error when runtime report creation fails", async () => {
		createRuntimeReport.mockResolvedValueOnce(null);

		const response = await POST({
			request: createRequest({
				datasetName: "effect-ts",
			}),
			redirect,
		} as Parameters<typeof POST>[0]);

		expect(createRuntimeReport).toHaveBeenCalledWith(
			"better-auth.session_token=test",
			{
				datasetName: "effect-ts",
			},
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"/?reportError=create-failed",
		);
	});

	test("redirects to the new report detail page when runtime creation succeeds", async () => {
		createRuntimeReport.mockResolvedValueOnce({
			id: "report-1",
			workspaceId: "workspace-1",
			slug: "effect-ts",
			name: "Effect TS",
			kind: "planetnik-report",
			status: "connected",
			analysisRoot: "/datasets/effect-ts/data",
			createdAt: "2026-04-02T17:20:19.145Z",
			updatedAt: "2026-04-02T17:20:19.145Z",
			lastSyncedAt: "2026-04-02T17:20:19.145Z",
		});

		const response = await POST({
			request: createRequest({
				name: "Effect TS",
				datasetName: "effect-ts",
			}),
			redirect,
		} as Parameters<typeof POST>[0]);

		expect(createRuntimeReport).toHaveBeenCalledWith(
			"better-auth.session_token=test",
			{
				name: "Effect TS",
				datasetName: "effect-ts",
			},
		);
		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(
			"/reports/effect-ts/overview?reportCreated=1",
		);
	});
});
