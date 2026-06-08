import {
  createGmScraperQuery,
  listGmScraperQueries,
} from "@/lib/gm-scraper/queries";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ queries: await listGmScraperQueries() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
    tagId?: unknown;
    campaignId?: unknown;
    stageId?: unknown;
    autoProcess?: unknown;
    maxResults?: unknown;
  } | null;

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const tagId = typeof body?.tagId === "string" ? body.tagId.trim() : "";

  if (!query) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }
  if (!tagId) {
    return Response.json({ error: "tagId is required" }, { status: 400 });
  }

  try {
    const row = await createGmScraperQuery({
      query,
      tagId,
      campaignId:
        typeof body?.campaignId === "string" ? body.campaignId : null,
      stageId: typeof body?.stageId === "string" ? body.stageId : null,
      autoProcess: body?.autoProcess === true,
      maxResults:
        typeof body?.maxResults === "number" ? body.maxResults : undefined,
    });

    return Response.json({ query: row }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create query";
    return Response.json({ error: message }, { status: 400 });
  }
}
