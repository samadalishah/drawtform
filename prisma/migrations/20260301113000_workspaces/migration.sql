-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- Add workspace reference to graphs (temporary nullable for backfill)
ALTER TABLE "graphs" ADD COLUMN "workspaceId" TEXT;

-- Backfill existing graphs into a legacy workspace
INSERT INTO "workspaces" ("id", "name", "ownerIp", "updatedAt")
VALUES ('legacy_workspace', 'Imported Workspace', 'legacy', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "graphs"
SET "workspaceId" = 'legacy_workspace'
WHERE "workspaceId" IS NULL;

-- Make relation mandatory and indexed
ALTER TABLE "graphs" ALTER COLUMN "workspaceId" SET NOT NULL;
CREATE INDEX "graphs_workspaceId_createdAt_idx" ON "graphs"("workspaceId", "createdAt" DESC);
CREATE INDEX "workspaces_ownerIp_createdAt_idx" ON "workspaces"("ownerIp", "createdAt" DESC);

-- Foreign key
ALTER TABLE "graphs"
ADD CONSTRAINT "graphs_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
