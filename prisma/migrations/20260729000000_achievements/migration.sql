-- What a player did beyond the numbers: records, honours, academic awards.
CREATE TABLE "Achievement" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "season" TEXT,
  "kind" TEXT,
  "text" TEXT NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Achievement_playerId_idx" ON "Achievement"("playerId");
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
