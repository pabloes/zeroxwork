-- The Discord channel moves from the watch row to the project, so a game is
-- set up in one form.
ALTER TABLE "projects" ADD COLUMN "discordChannelId" TEXT;

-- Carry over anything already configured BEFORE the old column goes. Without
-- this the drop below would lose it.
UPDATE "projects" p
   SET "discordChannelId" = w."channelId"
  FROM "repo_watches" w
 WHERE w."projectId" = p."id";

ALTER TABLE "repo_watches" DROP COLUMN "channelId";
