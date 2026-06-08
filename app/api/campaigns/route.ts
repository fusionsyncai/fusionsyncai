import { createCampaignWithPipeline } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      description: true,
      recallsyncCampaignId: true,
      createdAt: true,
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  return Response.json({
    campaigns: campaigns.map((campaign) => ({
      ...campaign,
      createdAt: campaign.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    recallsyncCampaignId?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const campaign = await createCampaignWithPipeline({
    name,
    description:
      typeof body?.description === "string" ? body.description : null,
    recallsyncCampaignId:
      typeof body?.recallsyncCampaignId === "string"
        ? body.recallsyncCampaignId
        : null,
  });

  return Response.json(
    { campaign: { ...campaign, createdAt: campaign.createdAt.toISOString() } },
    { status: 201 },
  );
}
