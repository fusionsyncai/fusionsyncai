import {
  deleteCampaignStage,
  renameCampaignStage,
  reorderCampaignStage,
  retryFailedCampaignStageContacts,
  setStageAction,
  setStageAutoProcessing,
  type StageDirection,
} from "@/lib/pipelines";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const { id, stageId } = await params;

  const stages = await deleteCampaignStage(id, stageId);

  if (!stages) {
    return Response.json(
      { error: "Campaign or stage not found" },
      { status: 404 },
    );
  }

  return Response.json({ stages });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const { id, stageId } = await params;
  const body = (await request.json().catch(() => null)) as {
    direction?: unknown;
    actionId?: unknown;
    name?: unknown;
    autoProcessing?: unknown;
    retryFailed?: unknown;
  } | null;

  // Reset this stage's FAILED contacts back to PENDING for reprocessing.
  if (body && body.retryFailed === true) {
    const result = await retryFailedCampaignStageContacts(id, stageId);

    if (!result) {
      return Response.json(
        { error: "Campaign or stage not found" },
        { status: 404 },
      );
    }

    return Response.json(result);
  }

  // Toggle auto-processing when autoProcessing is provided (boolean).
  if (body && "autoProcessing" in body) {
    const stages = await setStageAutoProcessing(
      id,
      stageId,
      Boolean(body.autoProcessing),
    );

    if (!stages) {
      return Response.json(
        { error: "Campaign or stage not found" },
        { status: 404 },
      );
    }

    return Response.json({ stages });
  }

  // Rename when a name is provided.
  if (body && "name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json(
        { error: "name must be a non-empty string" },
        { status: 400 },
      );
    }

    const stages = await renameCampaignStage(id, stageId, name);

    if (!stages) {
      return Response.json(
        { error: "Campaign or stage not found" },
        { status: 404 },
      );
    }

    return Response.json({ stages });
  }

  // Attach/detach an action when actionId is provided (string id or null).
  if (body && "actionId" in body) {
    const actionId =
      typeof body.actionId === "string" && body.actionId.trim()
        ? body.actionId
        : null;

    const stages = await setStageAction(id, stageId, actionId);

    if (!stages) {
      return Response.json(
        { error: "Campaign or stage not found" },
        { status: 404 },
      );
    }

    return Response.json({ stages });
  }

  // Otherwise treat it as a reorder.
  const direction = body?.direction;

  if (direction !== "up" && direction !== "down") {
    return Response.json(
      { error: "direction must be 'up' or 'down', or provide actionId" },
      { status: 400 },
    );
  }

  const stages = await reorderCampaignStage(
    id,
    stageId,
    direction as StageDirection,
  );

  if (!stages) {
    return Response.json(
      { error: "Campaign or stage not found" },
      { status: 404 },
    );
  }

  return Response.json({ stages });
}
