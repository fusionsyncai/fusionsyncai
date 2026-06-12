import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

// Paginated, stage-filterable list of a campaign's contacts. A campaign has at
// most one pipeline (Pipeline.campaignId is unique), so the stage filter needs
// no pipeline selector — `stageId` refers to a stage of this campaign's
// pipeline. Each row carries its current placement (stage + stageStatus) for
// that pipeline so the table can show "which stage is this contact in".
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);

  const stageId = url.searchParams.get("stageId")?.trim() || null;
  const page = parsePositiveInt(url.searchParams.get("page"), 1, 1_000_000);
  const pageSize = parsePositiveInt(
    url.searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, pipeline: { select: { id: true } } },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const pipelineId = campaign.pipeline?.id ?? null;

  // Filtering by stage is only meaningful when the campaign has a pipeline.
  if (stageId && !pipelineId) {
    return Response.json(
      { error: "Campaign has no pipeline to filter by stage" },
      { status: 400 },
    );
  }

  const where: Prisma.CampaignContactWhereInput = {
    campaignId: id,
    ...(stageId && pipelineId
      ? { contact: { pipelines: { some: { pipelineId, stageId } } } }
      : {}),
  };

  const total = await prisma.campaignContact.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const rows = await prisma.campaignContact.findMany({
    where,
    orderBy: { addedAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      addedAt: true,
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          companyName: true,
          companyShortName: true,
          quality: true,
          emailStatus: true,
          // Used by the configurable columns (personalizedHighlight, mailbox).
          customData: true,
          // Current placement in THIS campaign's pipeline. When the campaign
          // has no pipeline, the empty `where` id matches nothing (no rows),
          // keeping a single stable result type for the typechecker.
          pipelines: {
            where: { pipelineId: pipelineId ?? "" },
            take: 1,
            select: {
              stageStatus: true,
              stage: { select: { id: true, name: true, order: true } },
            },
          },
        },
      },
    },
  });

  const contacts = rows.map((row) => {
    const placement = row.contact.pipelines[0];
    const customData =
      row.contact.customData && typeof row.contact.customData === "object" &&
      !Array.isArray(row.contact.customData)
        ? (row.contact.customData as Record<string, unknown>)
        : {};
    const personalizedHighlight =
      typeof customData.personalizedHighlight === "string"
        ? customData.personalizedHighlight
        : null;
    const mailbox =
      typeof customData.mailbox === "string" ? customData.mailbox : null;

    return {
      id: row.contact.id,
      name: row.contact.name,
      email: row.contact.email,
      companyName: row.contact.companyName,
      companyShortName: row.contact.companyShortName,
      quality: row.contact.quality,
      emailStatus: row.contact.emailStatus,
      personalizedHighlight,
      mailbox,
      addedAt: row.addedAt.toISOString(),
      stage: placement?.stage ?? null,
      stageStatus: placement?.stageStatus ?? null,
    };
  });

  return Response.json({
    contacts,
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
  });
}
