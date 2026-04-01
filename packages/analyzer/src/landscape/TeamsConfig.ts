import type { TeamConfig } from "./TeamConfig.js";

export class TeamsConfig {
	teams: TeamConfig[] = [];

	getTeam(email: string): string | null {
		for (const team of this.teams) {
			for (const pattern of team.emailPatterns) {
				try {
					if (new RegExp(pattern).test(email)) {
						return team.name;
					}
				} catch {
					// invalid regex
				}
			}
		}
		return null;
	}
}
