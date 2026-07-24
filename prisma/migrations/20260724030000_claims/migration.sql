-- Claims library
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "metric" TEXT,
    "definition" TEXT,
    "population" TEXT,
    "period" TEXT,
    "denominator" TEXT,
    "source" TEXT,
    "coverage" TEXT,
    "authorizedUse" TEXT,
    "owner" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "asOf" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);
