-- Track NCAA national champions
ALTER TABLE "Player" ADD COLUMN "nationalChampion" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Player_nationalChampion_idx" ON "Player"("nationalChampion");
