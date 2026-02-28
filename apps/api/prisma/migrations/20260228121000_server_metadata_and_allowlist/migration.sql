-- Add server metadata and compatibility allowlist
ALTER TABLE "Server"
ADD COLUMN "address" TEXT;

ALTER TABLE "Server"
ADD COLUMN "allowedMinecraftVersions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Server" AS s
SET "address" = COALESCE(
  (
    SELECT pv."lockJson"->'defaultServer'->>'address'
    FROM "ProfileVersion" AS pv
    WHERE pv."serverId" = s."id"
    ORDER BY pv."version" DESC
    LIMIT 1
  ),
  'play.example.com:25565'
);

UPDATE "Server" AS s
SET "allowedMinecraftVersions" = ARRAY[
  COALESCE(
    (
      SELECT pv."minecraftVersion"
      FROM "ProfileVersion" AS pv
      WHERE pv."serverId" = s."id"
      ORDER BY pv."version" DESC
      LIMIT 1
    ),
    '1.20.1'
  )
]
WHERE cardinality(s."allowedMinecraftVersions") = 0;

ALTER TABLE "Server"
ALTER COLUMN "address" SET NOT NULL;

-- Snapshot the default server for each version
ALTER TABLE "ProfileVersion"
ADD COLUMN "defaultServerName" TEXT;

ALTER TABLE "ProfileVersion"
ADD COLUMN "defaultServerAddress" TEXT;

UPDATE "ProfileVersion" AS pv
SET
  "defaultServerName" = COALESCE(
    pv."lockJson"->'defaultServer'->>'name',
    s."name"
  ),
  "defaultServerAddress" = COALESCE(
    pv."lockJson"->'defaultServer'->>'address',
    s."address"
  )
FROM "Server" AS s
WHERE s."id" = pv."serverId";

ALTER TABLE "ProfileVersion"
ALTER COLUMN "defaultServerName" SET NOT NULL;

ALTER TABLE "ProfileVersion"
ALTER COLUMN "defaultServerAddress" SET NOT NULL;
