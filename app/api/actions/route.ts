import { createAction, listActions } from "@/lib/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ actions: await listActions() });
}

export async function POST(request: Request) {
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

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  if (!url) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const action = await createAction({
    name,
    method: typeof body?.method === "string" ? body.method : null,
    url,
    headers: body?.headers,
    body: body?.body,
    successCriteria: body?.successCriteria,
    batchSize: body?.batchSize,
    concurrency: body?.concurrency,
    advanceOnSuccess: body?.advanceOnSuccess,
    onSuccessTags: body?.onSuccessTags,
    onFailureTags: body?.onFailureTags,
  });

  return Response.json({ action }, { status: 201 });
}
