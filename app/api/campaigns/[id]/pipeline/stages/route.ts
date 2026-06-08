import { addStageToCampaignPipeline } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const stages = await addStageToCampaignPipeline(id, name);

  if (!stages) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ stages }, { status: 201 });
}
