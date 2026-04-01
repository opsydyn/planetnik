export class ContributorConnection {
	email: string;
	userName: string;
	count: number;
	commits: number;

	constructor(
		email: string = "",
		userName: string = "",
		count: number = 0,
		commits: number = 0,
	) {
		this.email = email;
		this.userName = userName;
		this.count = count;
		this.commits = commits;
	}
}

export class ContributorConnections {
	email: string = "";
	repositoriesCount: number = 0;
	connectionsCount: number = 0;
}
