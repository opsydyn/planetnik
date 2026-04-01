export class CommitInfo {
	id: string;
	date: string;
	email: string;

	constructor(id: string = "", date: string = "", email: string = "") {
		this.id = id;
		this.date = date;
		this.email = email;
	}
}
