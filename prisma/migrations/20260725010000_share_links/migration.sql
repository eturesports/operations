-- Revocable share links that let someone without an account edit one player
CREATE TABLE "PlayerShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlayerShareLink_token_key" ON "PlayerShareLink"("token");
CREATE INDEX "PlayerShareLink_playerId_idx" ON "PlayerShareLink"("playerId");

ALTER TABLE "PlayerShareLink" ADD CONSTRAINT "PlayerShareLink_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerShareLink" ADD CONSTRAINT "PlayerShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
