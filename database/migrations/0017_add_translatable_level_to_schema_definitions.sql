ALTER TABLE "schema_definitions" ADD COLUMN "level_key" text;
--> statement-breakpoint
WITH ranked_levels AS (
  SELECT level, DENSE_RANK() OVER (ORDER BY level) AS level_rank
  FROM (SELECT DISTINCT level FROM "schema_definitions") AS distinct_levels
)
UPDATE "schema_definitions" sd
SET level_key = 'level-' || ranked_levels.level_rank
FROM ranked_levels
WHERE ranked_levels.level = sd.level;
--> statement-breakpoint
ALTER TABLE "schema_definitions" ALTER COLUMN "level_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "schema_definitions" DROP CONSTRAINT "schema_definitions_level_version_unique";
--> statement-breakpoint
ALTER TABLE "schema_definitions" ADD CONSTRAINT "schema_definitions_level_key_version_unique" UNIQUE("level_key","version");
--> statement-breakpoint
-- Known existing level text as of this migration gets real en/zh
-- translations instead of falling back to Arabic in those locales; any
-- future/unexpected value still gets a usable (Arabic-only) row.
ALTER TABLE "schema_definitions" ALTER COLUMN "level" SET DATA TYPE jsonb USING (
  CASE level
    WHEN 'المستوى الأول' THEN jsonb_build_object('ar', level, 'en', 'Level 1', 'zh', '一级')
    WHEN 'المستوى الأول روسي' THEN jsonb_build_object('ar', level, 'en', 'Level 1 (Russian)', 'zh', '一级（俄语）')
    ELSE jsonb_build_object('ar', level)
  END
);
