import { ensurePipelineForCampaign } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pipeline = await ensurePipelineForCampaign(id);

  if (!pipeline) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ pipeline });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const pipeline = await ensurePipelineForCampaign(id);

  if (!pipeline) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ pipeline });
}
