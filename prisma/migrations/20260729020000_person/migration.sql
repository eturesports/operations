-- The person behind the operations, so records of the same player are tied
-- by identity rather than by their name matching.
CREATE TABLE "Person" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Player" ADD COLUMN "personId" TEXT;
CREATE INDEX "Player_personId_idx" ON "Player"("personId");
ALTER TABLE "Player" ADD CONSTRAINT "Player_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
