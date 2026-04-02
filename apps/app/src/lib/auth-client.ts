import { createAuthClient } from "better-auth/react";
import { SERVER_BASE_URL } from "./constants.js";

export const authClient = createAuthClient({
	baseURL: SERVER_BASE_URL,
});
