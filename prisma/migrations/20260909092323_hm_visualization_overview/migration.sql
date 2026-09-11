-- AlterTable
ALTER TABLE "hm_visualizations" ADD COLUMN     "overviewAlternativeProductIds" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "overviewClosing" TEXT,
ADD COLUMN     "overviewConsiderations" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "overviewHighlights" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "overviewOpening" TEXT,
ADD COLUMN     "overviewStatus" TEXT NOT NULL DEFAULT 'pending';
