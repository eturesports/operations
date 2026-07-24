-- PlayerProfile: a player's university stint(s), with per-season stats
CREATE TABLE "PlayerProfile" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "division" TEXT,
    "season" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "jersey" TEXT,
    "ncaaSport" TEXT DEFAULT 'soccer-men',
    "ncaaDivision" TEXT DEFAULT 'd1',
    "rosterUrl" TEXT,
    "matchesPlayed" INTEGER,
    "matchesStarted" INTEGER,
    "minutes" INTEGER,
    "goals" INTEGER,
    "assists" INTEGER,
    "points" INTEGER,
    "saves" INTEGER,
    "goalsAgainst" INTEGER,
    "statsUpdatedAt" TIMESTAMP(3),
    "statsSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayerProfile_playerId_idx" ON "PlayerProfile"("playerId");
CREATE INDEX "PlayerProfile_current_idx" ON "PlayerProfile"("current");

ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
