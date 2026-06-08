import {
  deleteGmScraperQuery,
  getGmScraperQuery,
  updateGmScraperQuery,
} from "@/lib/gm-scraper/queries";
import { GmScraperStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const query = await getGmScraperQuery(id);
  if (!query) {
    return Response.json({ error: "Query not found" }, { status: 404 });
  }
  return Response.json({ query });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    query?: unknown;
    tagId?: unknown;
    campaignId?: unknown;
    stageId?: unknown;
    autoProcess?: unknown;
    maxResults?: unknown;
    status?: unknown;
  } | null;

  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const status =
    typeof body.status === "string" &&
    Object.values(GmScraperStatus).includes(body.status as GmScraperStatus)
      ? (body.status as GmScraperStatus)
      : undefined;

  try {
    const query = await updateGmScraperQuery(id, {
      query: typeof body.query === "string" ? body.query : undefined,
      tagId: typeof body.tagId === "string" ? body.tagId : undefined,
      campaignId:
        body.campaignId === null
          ? null
          : typeof body.campaignId === "string"
            ? body.campaignId
            : undefined,
      stageId:
        body.stageId === null
          ? null
          : typeof body.stageId === "string"
            ? body.stageId
            : undefined,
      autoProcess:
        body.autoProcess !== undefined ? body.autoProcess === true : undefined,
      maxResults:
        typeof body.maxResults === "number" ? body.maxResults : undefined,
      status,
    });

    if (!query) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }

    return Response.json({ query });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update query";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const deleted = await deleteGmScraperQuery(id);
    if (!deleted) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }
    return Response.json({ deleted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete query";
    return Response.json({ error: message }, { status: 400 });
  }
}
