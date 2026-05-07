ALTER TABLE "invite_link" RENAME COLUMN "expense_group_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "payment" RENAME COLUMN "expense_group_id" TO "group_id";--> statement-breakpoint
ALTER TABLE "invite_link" DROP CONSTRAINT "invite_link_expense_group_id_expense_group_id_fk";
--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_expense_group_id_expense_group_id_fk";
--> statement-breakpoint
ALTER TABLE "invite_link" ADD CONSTRAINT "invite_link_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE no action ON UPDATE no action;