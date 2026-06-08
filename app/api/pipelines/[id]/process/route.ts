import { processPipeline } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

// Runs one processing tick for a pipeline: every armed stage (autoProcessing +
// action) has its action executed for its PENDING contacts. Intended to be
// called by a cron/worker. Safe to call repeatedly (claims are atomic).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const summary = await processPipeline(id);

  if (!summary) {
    return Response.json({ error: "Pipeline not found" }, { status: 404 });
  }

  return Response.json(summary);
}
