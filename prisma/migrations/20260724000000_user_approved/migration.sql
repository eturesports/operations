-- Add approval flag to User (external accounts require admin approval)
ALTER TABLE "User" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
