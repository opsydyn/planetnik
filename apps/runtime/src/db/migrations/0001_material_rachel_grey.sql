CREATE TABLE "report" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"analysis_root" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"last_synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_workspace_slug_unique" ON "report" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_unique" ON "workspace" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_owner_user_id_unique" ON "workspace" USING btree ("owner_user_id");