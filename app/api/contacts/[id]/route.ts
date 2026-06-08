import { deleteContact } from "@/lib/contacts-delete";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const contact = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      title: true,
      email: true,
      emailStatus: true,
      phone: true,
      linkedinUrl: true,
      companyName: true,
      companyWebsite: true,
      companyDomain: true,
      companyEmployeeCount: true,
      companyIndustry: true,
      companyLocation: true,
      companyLinkedinUrl: true,
      quality: true,
      score: true,
      enrichmentStatus: true,
      enrichedAt: true,
      source: true,
      sourceUrl: true,
      customData: true,
      recallsyncLeadId: true,
      syncedAt: true,
      createdAt: true,
      updatedAt: true,
      tags: {
        select: {
          assignedAt: true,
          tag: { select: { id: true, name: true, color: true } },
        },
      },
      campaigns: {
        select: {
          addedAt: true,
          campaign: { select: { id: true, name: true } },
        },
      },
      pipelines: {
        select: {
          id: true,
          stageStatus: true,
          addedToStageAt: true,
          pipeline: {
            select: {
              id: true,
              name: true,
              campaign: { select: { id: true, name: true } },
            },
          },
          stage: { select: { id: true, name: true, order: true } },
        },
      },
    },
  });

  if (!contact) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  // For each pipeline the contact is in, fetch the ordered stage list so the UI
  // can render the full stage track and highlight the contact's current stage.
  const pipelineIds = contact.pipelines.map((p) => p.pipeline.id);
  const stages = pipelineIds.length
    ? await prisma.stage.findMany({
        where: { pipelineId: { in: pipelineIds } },
        orderBy: { order: "asc" },
        select: { id: true, name: true, order: true, pipelineId: true },
      })
    : [];

  return Response.json({
    contact: {
      ...contact,
      enrichedAt: contact.enrichedAt?.toISOString() ?? null,
      syncedAt: contact.syncedAt?.toISOString() ?? null,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
      tags: contact.tags.map((t) => ({
        id: t.tag.id,
        name: t.tag.name,
        color: t.tag.color,
        assignedAt: t.assignedAt.toISOString(),
      })),
      campaigns: contact.campaigns.map((c) => ({
        id: c.campaign.id,
        name: c.campaign.name,
        addedAt: c.addedAt.toISOString(),
      })),
      pipelines: contact.pipelines.map((p) => ({
        pipelineId: p.pipeline.id,
        pipelineName: p.pipeline.name,
        campaignId: p.pipeline.campaign?.id ?? null,
        campaignName: p.pipeline.campaign?.name ?? null,
        currentStageId: p.stage.id,
        currentStageName: p.stage.name,
        currentStageOrder: p.stage.order,
        stageStatus: p.stageStatus,
        addedToStageAt: p.addedToStageAt.toISOString(),
        stages: stages
          .filter((s) => s.pipelineId === p.pipeline.id)
          .map((s) => ({ id: s.id, name: s.name, order: s.order })),
      })),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const deleted = await deleteContact(id);

  if (!deleted) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  return Response.json({ ok: true, deleted: 1 });
}
