import { deleteAction, updateAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    method?: unknown;
    url?: unknown;
    headers?: unknown;
    body?: unknown;
    successCriteria?: unknown;
    batchSize?: unknown;
    concurrency?: unknown;
    advanceOnSuccess?: unknown;
    onSuccessTags?: unknown;
    onFailureTags?: unknown;
  } | null;

  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const url = typeof body.url === "string" ? body.url.trim() : undefined;

  if (name !== undefined && !name) {
    return Response.json({ error: "name cannot be empty" }, { status: 400 });
  }

  if (url !== undefined && !url) {
    return Response.json({ error: "url cannot be empty" }, { status: 400 });
  }

  const updated = await updateAction(id, {
    name,
    method: typeof body.method === "string" ? body.method : undefined,
    url,
    ...("headers" in body ? { headers: body.headers } : {}),
    ...("body" in body ? { body: body.body } : {}),
    ...("successCriteria" in body
      ? { successCriteria: body.successCriteria }
      : {}),
    ...("batchSize" in body ? { batchSize: body.batchSize } : {}),
    ...("concurrency" in body ? { concurrency: body.concurrency } : {}),
    ...("advanceOnSuccess" in body
      ? { advanceOnSuccess: body.advanceOnSuccess }
      : {}),
    ...("onSuccessTags" in body
      ? { onSuccessTags: body.onSuccessTags }
      : {}),
    ...("onFailureTags" in body
      ? { onFailureTags: body.onFailureTags }
      : {}),
  });

  if (!updated) {
    return Response.json({ error: "Action not found" }, { status: 404 });
  }

  return Response.json({ action: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const deleted = await deleteAction(id);

  if (!deleted) {
    return Response.json({ error: "Action not found" }, { status: 404 });
  }

  return Response.json({ deleted });
}
