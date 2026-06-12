import { processSingleContact } from "@/lib/pipelines";

export const dynamic = "force-dynamic";

// Manually runs the contact's current stage action once (the per-row "process"
// button in the campaign contacts tab). Ignores the stage's autoProcessing
// flag so a single contact can be tested without arming the stage for cron.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const { id, contactId } = await params;

  const result = await processSingleContact(id, contactId);

  if (!result) {
    return Response.json(
      { error: "Campaign has no pipeline" },
      { status: 404 },
    );
  }

  return Response.json(result);
}
