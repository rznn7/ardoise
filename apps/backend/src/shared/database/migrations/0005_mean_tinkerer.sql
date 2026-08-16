ALTER TABLE "invite_link" RENAME COLUMN "consumed_by_user_id" TO "burned_by_user_id";--> statement-breakpoint
ALTER TABLE "invite_link" RENAME COLUMN "consumed_at" TO "burned_at";--> statement-breakpoint
ALTER TABLE "invite_link" DROP CONSTRAINT "invite_link_consumed_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_burned_by_user_id_users_id_fk" FOREIGN KEY ("burned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;