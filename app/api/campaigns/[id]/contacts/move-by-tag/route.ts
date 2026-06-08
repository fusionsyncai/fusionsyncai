import { moveCampaignContactsByTagToStage } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

// Bulk move: every contact in this campaign tagged `tagId` is placed into
// `stageId` (a stage of the campaign's single pipeline), resetting them to
// PENDING. This is how outcome tags become actionable (e.g. sweep all
// "invalid-email" contacts into a fallback stage).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    tagId?: unknown;
    stageId?: unknown;
  } | null;

  const tagId = typeof body?.tagId === "string" ? body.tagId.trim() : "";
  const stageId = typeof body?.stageId === "string" ? body.stageId.trim() : "";

  if (!tagId) {
    return Response.json({ error: "tagId is required" }, { status: 400 });
  }
  if (!stageId) {
    return Response.json({ error: "stageId is required" }, { status: 400 });
  }

  const result = await moveCampaignContactsByTagToStage(id, stageId, tagId);

  if (!result) {
    return Response.json(
      { error: "Campaign, pipeline, or stage not found" },
      { status: 404 },
    );
  }

  return Response.json(result);
}
