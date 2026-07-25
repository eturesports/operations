-- Graduation outcome on players
ALTER TABLE "Player" ADD COLUMN "graduated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "graduationYear" INTEGER;

CREATE INDEX "Player_graduated_idx" ON "Player"("graduated");
