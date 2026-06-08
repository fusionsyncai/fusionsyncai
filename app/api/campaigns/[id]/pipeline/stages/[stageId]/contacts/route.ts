import { addContactsToCampaignStage } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; stageId: string }> },
) {
  const { id, stageId } = await params;
  const body = (await request.json().catch(() => null)) as {
    contactIds?: unknown;
  } | null;

  const contactIds = Array.isArray(body?.contactIds)
    ? body.contactIds.filter((value): value is string => typeof value === "string")
    : [];

  if (contactIds.length === 0) {
    return Response.json(
      { error: "contactIds must be a non-empty array of contact ids" },
      { status: 400 },
    );
  }

  const result = await addContactsToCampaignStage(id, stageId, contactIds);

  if (!result) {
    return Response.json(
      { error: "Campaign or stage not found" },
      { status: 404 },
    );
  }

  return Response.json(result);
}
