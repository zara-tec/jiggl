-- CreateTable
CREATE TABLE "WorkspaceMail" (
    "workspaceId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "security" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMail_pkey" PRIMARY KEY ("workspaceId")
);

-- AddForeignKey
ALTER TABLE "WorkspaceMail" ADD CONSTRAINT "WorkspaceMail_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

