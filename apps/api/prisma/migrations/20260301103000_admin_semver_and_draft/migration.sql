-- Add semantic release metadata to profile versions
ALTER TABLE "ProfileVersion"
ADD COLUMN "releaseVersion" TEXT NOT NULL DEFAULT '1.0.0';

-- Backfill existing rows with a deterministic semantic version baseline
UPDATE "ProfileVersion"
SET "releaseVersion" = CONCAT('1.0.', GREATEST("version" - 1, 0)::TEXT)
WHERE "releaseVersion" = '1.0.0';

-- Add release cursor + draft payload storage to app settings
ALTER TABLE "AppSetting"
ADD COLUMN "releaseMajor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "releaseMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "releasePatch" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "publishDraft" JSONB;
