-- Fusaha library launch: migrations 0022 + 0024 (atomic, single transaction)
-- Generated verbatim from database/migrations/0022_add_library_books.sql and 0024_library_files.sql.
-- Preconditions verified: none of library_books / library_files / library_book_files /
-- library_download_grants exist in Production (checked 2026-11-07); users exists (FK target).
-- DDL in PostgreSQL is transactional: any failure rolls back everything.

BEGIN;

CREATE TABLE "library_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"original_title" text NOT NULL,
	"authors" text NOT NULL,
	"publisher" text,
	"publication_year" integer,
	"original_language" text DEFAULT 'ar' NOT NULL,
	"isbn" text,
	"category" text NOT NULL,
	"audience" text NOT NULL,
	"level" text NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"display_title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"long_description" jsonb,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"destination_type" text NOT NULL,
	"access_status" text DEFAULT 'unknown' NOT NULL,
	"access_notes" jsonb,
	"cover_url" text,
	"cover_alt" jsonb,
	"publication_status" text DEFAULT 'draft' NOT NULL,
	"review_status" text DEFAULT 'needs_review' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "library_books_slug_unique" UNIQUE("slug")
);

CREATE TABLE "library_book_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "library_download_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "library_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sha256" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"content_type" text NOT NULL,
	"original_filename" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_files_sha256_unique" UNIQUE("sha256"),
	CONSTRAINT "library_files_storage_key_unique" UNIQUE("storage_key")
);
ALTER TABLE "library_book_files" ADD CONSTRAINT "library_book_files_book_id_library_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."library_books"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "library_book_files" ADD CONSTRAINT "library_book_files_file_id_library_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."library_files"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "library_download_grants" ADD CONSTRAINT "library_download_grants_book_id_library_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."library_books"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "library_download_grants" ADD CONSTRAINT "library_download_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "library_download_grants" ADD CONSTRAINT "library_download_grants_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "library_files" ADD CONSTRAINT "library_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "library_book_files_book_unique" ON "library_book_files" USING btree ("book_id");
CREATE UNIQUE INDEX "library_download_grants_book_user_unique" ON "library_download_grants" USING btree ("book_id","user_id");

COMMIT;
