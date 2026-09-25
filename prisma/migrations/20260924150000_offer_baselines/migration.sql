-- CreateTable
CREATE TABLE "OfferBaseline" (
    "workspaceId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "kind" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "discountPct" DOUBLE PRECISION,
    "lines" JSONB NOT NULL,
    "costRates" JSONB NOT NULL,
    "billingRates" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferBaseline_pkey" PRIMARY KEY ("workspaceId","id")
);

-- CreateIndex
CREATE INDEX "OfferBaseline_workspaceId_offerId_idx" ON "OfferBaseline"("workspaceId", "offerId");

-- CreateIndex
CREATE INDEX "OfferBaseline_workspaceId_projectId_idx" ON "OfferBaseline"("workspaceId", "projectId");

-- AddForeignKey
ALTER TABLE "OfferBaseline" ADD CONSTRAINT "OfferBaseline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

