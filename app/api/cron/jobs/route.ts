import { createCronJob, listCronJobs } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ jobs: await listCronJobs() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    type?: unknown;
    intervalSeconds?: unknown;
    enabled?: unknown;
  } | null;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const result = await createCronJob({
    name,
    type: body?.type,
    intervalSeconds: body?.intervalSeconds,
    enabled: body?.enabled,
  });

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ job: result.job }, { status: 201 });
}
