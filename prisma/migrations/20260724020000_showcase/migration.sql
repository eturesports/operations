-- Showcase universities (per year)
CREATE TABLE "ShowcaseUniversity" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "logoUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShowcaseUniversity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShowcaseUniversity_year_idx" ON "ShowcaseUniversity"("year");
