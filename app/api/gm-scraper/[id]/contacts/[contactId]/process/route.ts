import { processGmScraperContact } from "@/lib/gm-scraper/queries";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const { id, contactId } = await params;

  try {
    const result = await processGmScraperContact(id, contactId);
    if (!result) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }
    return Response.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to process contact";
    return Response.json({ error: message }, { status: 400 });
  }
}
