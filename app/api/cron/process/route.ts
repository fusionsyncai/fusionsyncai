import { processAllPipelines } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

// Cron entry point: processes armed stages across every pipeline. Protected by
// a shared secret (Authorization: Bearer <CRON_SECRET>). Single-flight: if a
// run is already in progress it returns { skipped: true } instead of piling up.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await processAllPipelines();
  return Response.json(summary);
}
