-- Being drafted happens once, to a person, at the end of their college years.
-- It is not a fact about a university the way a scholarship or a conference
-- title is, so it sits on the record and is mirrored across the person's other
-- operations like their nationality — and every count of it counts people,
-- never operations, or a player with three stints would be three draft picks.
ALTER TABLE "Player"
  ADD COLUMN IF NOT EXISTS "mlsDraftYear"  INTEGER,
  ADD COLUMN IF NOT EXISTS "mlsDraftClub"  TEXT,
  ADD COLUMN IF NOT EXISTS "mlsDraftRound" INTEGER,
  ADD COLUMN IF NOT EXISTS "mlsDraftPick"  INTEGER;
