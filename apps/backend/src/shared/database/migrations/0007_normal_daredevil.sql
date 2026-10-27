ALTER TABLE "invite_link" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "id" integer NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "session_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_id_unique" UNIQUE("id");