-- Scholarships that cover everything, not just part of the cost
ALTER TABLE "Player" ADD COLUMN "fullRide" BOOLEAN NOT NULL DEFAULT false;
