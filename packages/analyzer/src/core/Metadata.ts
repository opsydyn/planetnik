import { Schema } from "@effect/schema";
import { Link, type LinkType } from "./Link.js";

const MetadataSchema = Schema.Struct({
	name: Schema.optionalWith(Schema.String, { default: () => "" }),
	description: Schema.optionalWith(Schema.String, { default: () => "" }),
	tooltip: Schema.optionalWith(Schema.String, { default: () => "" }),
	logoLink: Schema.optionalWith(Schema.String, { default: () => "" }),
	links: Schema.optionalWith(Schema.Array(Link.schema), { default: () => [] }),
});

export type MetadataType = {
	name: string;
	description: string;
	tooltip: string;
	logoLink: string;
	links: LinkType[];
};

export const Metadata = {
	schema: MetadataSchema,

	make(input: Partial<MetadataType>): MetadataType {
		const decoded = Schema.decodeUnknownSync(MetadataSchema)(input);
		return {
			name: decoded.name,
			description: decoded.description,
			tooltip: decoded.tooltip,
			logoLink: decoded.logoLink,
			links: [...decoded.links],
		};
	},
};
