import { bulkDeleteContacts } from "@/lib/contacts-delete";

export const dynamic = "force-dynamic";

type DeleteBody = {
  ids?: unknown;
  tagId?: unknown;
  from?: unknown;
  to?: unknown;
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DeleteBody | null;

  const ids = Array.isArray(body?.ids)
    ? body.ids.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
    : [];

  const tagId =
    typeof body?.tagId === "string" && body.tagId.trim()
      ? body.tagId.trim()
      : null;

  const from = parseDate(body?.from);
  const to = parseDate(body?.to);

  const deleted = await bulkDeleteContacts({ ids, tagId, from, to });

  if (deleted === null) {
    return Response.json(
      { error: "Provide at least one filter: ids, tagId, from, or to" },
      { status: 400 },
    );
  }

  return Response.json({ ok: true, deleted });
}
