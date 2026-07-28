import { regenerateDrafts, serializeOutreachItem } from "@/lib/outreach/service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const item = await regenerateDrafts(id);
    return Response.json({ item: serializeOutreachItem(item) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to regenerate";
    return Response.json({ error: message }, { status: 400 });
  }
}
