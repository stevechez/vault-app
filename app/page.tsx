import { prisma } from "@/lib/prisma";
import { AssetGrid } from "@/components/AssetGrid";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const assets = await prisma.asset.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
  });

  return <AssetGrid initialAssets={assets} />;
}
