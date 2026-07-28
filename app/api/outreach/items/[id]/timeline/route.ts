import { OutreachItemStatus, OutreachTimelineType } from "@/generated/prisma/client";

import { addTimelineEntry, serializeOutreachItem } from "@/lib/outreach/service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    body?: unknown;
    status?: unknown;
  } | null;

  const noteBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!noteBody) {
    return Response.json({ error: "body is required" }, { status: 400 });
  }

  const type =
    body?.type === "NOTE_RECEIVED"
      ? OutreachTimelineType.NOTE_RECEIVED
      : OutreachTimelineType.NOTE_SENT;

  const status =
    typeof body?.status === "string" &&
    Object.values(OutreachItemStatus).includes(body.status as OutreachItemStatus)
      ? (body.status as OutreachItemStatus)
      : body?.status === "SUCCESS"
        ? OutreachItemStatus.SUCCESS
        : undefined;

  try {
    const result = await addTimelineEntry(id, {
      type,
      body: noteBody,
      status,
    });

    return Response.json({
      entry: {
        ...result.entry,
        createdAt: result.entry.createdAt.toISOString(),
      },
      item: serializeOutreachItem(result.item),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add note";
    return Response.json({ error: message }, { status: 400 });
  }
}
