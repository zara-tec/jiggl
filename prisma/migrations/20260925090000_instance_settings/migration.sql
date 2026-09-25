-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL,
    "registration" TEXT NOT NULL DEFAULT 'open',
    "domains" JSONB NOT NULL,
    "ownerAccountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

