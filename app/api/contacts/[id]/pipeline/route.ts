import {
  setContactPipelinePlacement,
  type ContactStageStatus,
} from "@/lib/pipelines";

export const dynamic = "force-dynamic";

const STAGE_STATUSES: ContactStageStatus[] = [
  "PENDING",
  "PROCESSING",
  "FAILED",
  "WAITING",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    pipelineId?: unknown;
    stageId?: unknown;
    stageStatus?: unknown;
  } | null;

  const pipelineId =
    typeof body?.pipelineId === "string" ? body.pipelineId.trim() : "";
  if (!pipelineId) {
    return Response.json({ error: "pipelineId is required" }, { status: 400 });
  }

  const stageId =
    typeof body?.stageId === "string" && body.stageId.trim()
      ? body.stageId.trim()
      : undefined;

  let stageStatus: ContactStageStatus | undefined;
  if (body?.stageStatus !== undefined) {
    if (
      typeof body.stageStatus !== "string" ||
      !STAGE_STATUSES.includes(body.stageStatus as ContactStageStatus)
    ) {
      return Response.json(
        { error: `stageStatus must be one of ${STAGE_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    stageStatus = body.stageStatus as ContactStageStatus;
  }

  if (!stageId && !stageStatus) {
    return Response.json(
      { error: "Provide stageId and/or stageStatus" },
      { status: 400 },
    );
  }

  try {
    const result = await setContactPipelinePlacement(id, pipelineId, {
      stageId,
      stageStatus,
    });
    if (!result) {
      return Response.json(
        { error: "Contact is not in this pipeline" },
        { status: 404 },
      );
    }
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update placement";
    return Response.json({ error: message }, { status: 400 });
  }
}
