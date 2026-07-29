-- The money is agreed with a university, so it belongs to that stint
ALTER TABLE "PlayerProfile" ADD COLUMN "scholarship" INTEGER;
ALTER TABLE "PlayerProfile" ADD COLUMN "fullRide" BOOLEAN NOT NULL DEFAULT false;
