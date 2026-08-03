-- A conference title is won with a particular team in a particular season, so
-- it belongs to the college profile, next to the division and the money —
-- not to the person, who may win one at one university and not at the next.
--
-- The conference name is stored rather than derived: a school's soccer
-- conference can differ from its primary one, and conferences realign, so the
-- record should keep saying what was actually won.
ALTER TABLE "PlayerProfile"
  ADD COLUMN IF NOT EXISTS "conferenceChampion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "conferenceName" TEXT;
