-- Whether Eture brokered a stint, or the player arranged it himself.
--
-- Defaults to true on purpose: every row that exists today was an operation of
-- ours, so the backfill is the default and no UPDATE is needed.
ALTER TABLE "PlayerProfile" ADD COLUMN "byEture" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Player" ADD COLUMN "byEture" BOOLEAN NOT NULL DEFAULT true;

-- Every count of operations filters on this column, and they all filter on
-- `active` too.
CREATE INDEX "Player_byEture_idx" ON "Player"("byEture");
