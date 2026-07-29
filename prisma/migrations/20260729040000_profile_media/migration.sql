-- A photo belongs to the shirt the player was wearing
ALTER TABLE "PlayerProfile" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "PlayerProfile" ADD COLUMN "actionImageUrl" TEXT;
