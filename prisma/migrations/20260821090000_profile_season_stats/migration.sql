-- One season of one player at one university.
--
-- The roster feeds always reported a season at a time: the refresh walked
-- back year by year and added them up, keeping only the total and a count of
-- how many seasons it covered. "How many minutes this season" was being
-- fetched and thrown away on every run. This is where each season lands
-- before anything is added up.
--
-- The columns on PlayerProfile are untouched and keep meaning the same thing —
-- the career total at that university — so nothing that already reads them
-- has to change. They are now the sum of these rows rather than a separate
-- reading of the same feed.

CREATE TABLE "ProfileSeasonStat" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    -- The calendar year the feed files the season under. NCAA soccer is an
    -- autumn sport, so 2025 is the season running into 2026 — the one the
    -- rest of the app calls "25/26".
    "year" INTEGER NOT NULL,
    "season" TEXT,
    "matchesPlayed" INTEGER,
    "matchesStarted" INTEGER,
    "minutes" INTEGER,
    "goals" INTEGER,
    "assists" INTEGER,
    "points" INTEGER,
    "saves" INTEGER,
    "goalsAgainst" INTEGER,
    "source" TEXT,
    "statsUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileSeasonStat_pkey" PRIMARY KEY ("id")
);

-- One row per profile per season: a refresh replaces, never accumulates.
-- A season in progress is re-read every week and the feed reports it to date,
-- so without this a weekly cron would multiply a player's minutes by the
-- number of weeks left in the season.
CREATE UNIQUE INDEX "ProfileSeasonStat_profileId_year_key"
    ON "ProfileSeasonStat"("profileId", "year");

CREATE INDEX "ProfileSeasonStat_year_idx" ON "ProfileSeasonStat"("year");

ALTER TABLE "ProfileSeasonStat"
    ADD CONSTRAINT "ProfileSeasonStat_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
