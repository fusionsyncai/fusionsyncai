import { deleteCronJob, updateCronJob } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    intervalSeconds?: unknown;
    enabled?: unknown;
  } | null;

  if (!body) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const job = await updateCronJob(id, body);
  if (!job) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({ job });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const deleted = await deleteCronJob(id);

  if (!deleted) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json({ deleted });
}
