import { pushGmScraperContactsToStage } from "@/lib/gm-scraper/queries";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    campaignId?: unknown;
    stageId?: unknown;
  } | null;

  const campaignId =
    typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
  const stageId = typeof body?.stageId === "string" ? body.stageId.trim() : "";

  if (!campaignId || !stageId) {
    return Response.json(
      { error: "campaignId and stageId are required" },
      { status: 400 },
    );
  }

  try {
    const result = await pushGmScraperContactsToStage(id, {
      campaignId,
      stageId,
    });

    if (!result) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }

    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to push contacts to stage";
    return Response.json({ error: message }, { status: 400 });
  }
}
