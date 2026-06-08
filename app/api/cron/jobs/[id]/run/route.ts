import { runCronJobNow } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";

// Manual "Run now" from the dashboard. Does not require the job to be enabled.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await runCronJobNow(id);

  if (!result) {
    return Response.json({ error: "Job not found" }, { status: 404 });
  }

  return Response.json(result);
}
