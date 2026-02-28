-- AlterTable
ALTER TABLE "Server"
ADD COLUMN "fancyMenuEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fancyMenuSettings" JSONB;

-- AlterTable
ALTER TABLE "ProfileVersion"
ADD COLUMN "fancyMenuEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fancyMenuSettings" JSONB;

-- Backfill from lockJson when present
UPDATE "ProfileVersion" pv
SET
  "fancyMenuEnabled" = COALESCE((pv."lockJson"->'fancyMenu'->>'enabled')::BOOLEAN, false),
  "fancyMenuSettings" = CASE
    WHEN jsonb_typeof(pv."lockJson"->'fancyMenu') = 'object' THEN pv."lockJson"->'fancyMenu'
    ELSE NULL
  END;

UPDATE "Server" s
SET
  "fancyMenuEnabled" = COALESCE(
    (
      SELECT pv."fancyMenuEnabled"
      FROM "ProfileVersion" pv
      WHERE pv."serverId" = s."id"
      ORDER BY pv."version" DESC
      LIMIT 1
    ),
    false
  ),
  "fancyMenuSettings" = (
    SELECT pv."fancyMenuSettings"
    FROM "ProfileVersion" pv
    WHERE pv."serverId" = s."id"
    ORDER BY pv."version" DESC
    LIMIT 1
  );
