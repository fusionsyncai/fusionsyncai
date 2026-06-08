import { prisma } from "@/lib/prisma";

// Lean default stages for an auto-created pipeline (Discovered -> Qualified -> Synced).
export const DEFAULT_PIPELINE_STAGES = ["Discovered", "Qualified", "Synced"];

function defaultStagesCreate() {
  return DEFAULT_PIPELINE_STAGES.map((name, index) => ({ name, order: index }));
}

type CreateCampaignInput = {
  name: string;
  description?: string | null;
  recallsyncCampaignId?: string | null;
};

// Creates a campaign together with its 1:1 pipeline (and default stages) in a
// single transaction. Every campaign gets a pipeline for the current use case.
export async function createCampaignWithPipeline(input: CreateCampaignInput) {
  return prisma.$transaction(async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        recallsyncCampaignId: input.recallsyncCampaignId ?? null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        recallsyncCampaignId: true,
        createdAt: true,
      },
    });

    await tx.pipeline.create({
      data: {
        name: input.name,
        campaignId: campaign.id,
        stages: { create: defaultStagesCreate() },
      },
    });

    return campaign;
  });
}

// Idempotently ensures a campaign has a pipeline (with default stages). Returns
// the existing or newly created pipeline, or null if the campaign is missing.
export async function ensurePipelineForCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      pipeline: {
        select: {
          id: true,
          name: true,
          stages: {
            orderBy: { order: "asc" },
            select: { id: true, name: true, order: true },
          },
        },
      },
    },
  });

  if (!campaign) {
    return null;
  }

  if (campaign.pipeline) {
    return campaign.pipeline;
  }

  return prisma.pipeline.create({
    data: {
      name: campaign.name,
      campaignId: campaign.id,
      stages: { create: defaultStagesCreate() },
    },
    select: {
      id: true,
      name: true,
      stages: {
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true },
      },
    },
  });
}
