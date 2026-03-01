-- CreateTable
CREATE TABLE "graphs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graphs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_nodes" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "resourceType" TEXT,
    "thumbnailKey" TEXT,
    "cloudProvider" TEXT,
    "source" TEXT,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "graph_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_edges" (
    "id" TEXT NOT NULL,
    "graphId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "graph_edges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graph_nodes_graphId_externalId_key" ON "graph_nodes"("graphId", "externalId");

-- CreateIndex
CREATE INDEX "graph_nodes_graphId_idx" ON "graph_nodes"("graphId");

-- CreateIndex
CREATE INDEX "graph_edges_graphId_idx" ON "graph_edges"("graphId");

-- CreateIndex
CREATE INDEX "graph_edges_sourceId_targetId_idx" ON "graph_edges"("sourceId", "targetId");

-- AddForeignKey
ALTER TABLE "graph_nodes" ADD CONSTRAINT "graph_nodes_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_graphId_fkey" FOREIGN KEY ("graphId") REFERENCES "graphs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
