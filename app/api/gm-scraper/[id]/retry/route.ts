import { retryGmScraperQuery } from "@/lib/gm-scraper/queries";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const query = await retryGmScraperQuery(id);
    if (!query) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }
    return Response.json({ query });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to retry query";
    return Response.json({ error: message }, { status: 400 });
  }
}
