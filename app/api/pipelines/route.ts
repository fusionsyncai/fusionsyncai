import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const pipelines = await prisma.pipeline.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      campaignId: true,
      createdAt: true,
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
      stages: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
      _count: {
        select: {
          contacts: true,
        },
      },
    },
  });

  return Response.json({
    pipelines: pipelines.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      campaignId: pipeline.campaignId,
      campaignName: pipeline.campaign?.name ?? null,
      stages: pipeline.stages,
      contactCount: pipeline._count.contacts,
      createdAt: pipeline.createdAt.toISOString(),
    })),
  });
}
