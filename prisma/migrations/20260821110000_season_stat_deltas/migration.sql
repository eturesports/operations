-- What a season row said at the previous refresh.
--
-- The roster feeds report a season to date and never a list of goals with
-- dates on them, so "who scored this week" cannot be read from them — only
-- noticed, by comparing one refresh against the one before. Keeping the
-- previous figures beside the current ones is enough for that, and costs no
-- history table.
--
-- IF NOT EXISTS throughout: the table this adds to is created by a migration
-- that has to be run by hand, so this one may arrive before it, after it, or
-- twice. It has to be safe in all three cases.

CREATE TABLE IF NOT EXISTS "ProfileSeasonStat" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
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

ALTER TABLE "ProfileSeasonStat" ADD COLUMN IF NOT EXISTS "prevGoals" INTEGER;
ALTER TABLE "ProfileSeasonStat" ADD COLUMN IF NOT EXISTS "prevAssists" INTEGER;
ALTER TABLE "ProfileSeasonStat" ADD COLUMN IF NOT EXISTS "prevMinutes" INTEGER;
ALTER TABLE "ProfileSeasonStat" ADD COLUMN IF NOT EXISTS "prevMatches" INTEGER;
ALTER TABLE "ProfileSeasonStat" ADD COLUMN IF NOT EXISTS "prevAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileSeasonStat_profileId_year_key"
    ON "ProfileSeasonStat"("profileId", "year");
CREATE INDEX IF NOT EXISTS "ProfileSeasonStat_year_idx" ON "ProfileSeasonStat"("year");

-- The foreign key has no IF NOT EXISTS, so it is added only when absent.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ProfileSeasonStat_profileId_fkey'
    ) THEN
        ALTER TABLE "ProfileSeasonStat"
            ADD CONSTRAINT "ProfileSeasonStat_profileId_fkey"
            FOREIGN KEY ("profileId") REFERENCES "PlayerProfile"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
